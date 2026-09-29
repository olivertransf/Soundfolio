import Foundation
import FirebaseFirestore

enum StreamStoreError: LocalizedError {
    case notStarted

    var errorDescription: String? {
        switch self {
        case .notStarted:
            "Library is not loaded yet."
        }
    }
}

@MainActor
@Observable
final class StreamStore {
    private(set) var streams: [StreamRecord] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private(set) var revision = 0

    private var activeUID: String?
    private var persistTask: Task<Void, Never>?
    private var catchUpTask: Task<Void, Never>?

    func start(uid: String) {
        guard activeUID != uid else { return }
        stop()
        activeUID = uid
        errorMessage = nil

        if let cached = StreamPersistence.load(uid: uid), !cached.isEmpty {
            streams = cached
            revision &+= 1
            isLoading = false
        } else {
            isLoading = true
        }

        catchUpTask = Task {
            do {
                try await self.catchUp(uid: uid)
            } catch {
                if !Task.isCancelled {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    /// Pull-to-refresh. Reads plays newer than the local library, not the whole collection.
    func reloadFromServer() async throws {
        guard let uid = activeUID else {
            throw StreamStoreError.notStarted
        }
        errorMessage = nil
        try await catchUp(uid: uid)
    }

    private func catchUp(uid: String) async throws {
        let remote = try await fetchRemote(uid: uid, after: streams.map(\.playedAt).max())
        guard !Task.isCancelled else { return }
        isLoading = false
        guard !remote.isEmpty else { return }
        let next = Self.mergeStreams(local: streams, remote: remote)
        guard next != streams else { return }
        streams = next
        revision &+= 1
        schedulePersist(uid: uid)
    }

    /// `after` limits the read to new plays. A missing local library is the one full read.
    private func fetchRemote(uid: String, after: Date?) async throws -> [StreamRecord] {
        let base = Firestore.firestore()
            .collection("users")
            .document(uid)
            .collection("streams")
        if let after {
            var collected: [StreamRecord] = []
            var last: QueryDocumentSnapshot?
            for _ in 0..<5 {
                var page = base
                    .whereField("playedAt", isGreaterThan: Timestamp(date: after))
                    .order(by: "playedAt", descending: true)
                    .limit(to: 100)
                if let last {
                    page = page.start(afterDocument: last)
                }
                let snap = try await page.getDocuments()
                collected.append(contentsOf: snap.documents.compactMap { Self.record(from: $0) })
                guard snap.documents.count == 100, let end = snap.documents.last else { break }
                last = end
            }
            return collected
        }

        let snap = try await base.order(by: "playedAt", descending: true).getDocuments()
        return snap.documents.compactMap { Self.record(from: $0) }
    }

    func stop() {
        catchUpTask?.cancel()
        catchUpTask = nil
        persistTask?.cancel()
        persistTask = nil
        if let activeUID {
            StreamPersistence.clear(uid: activeUID)
        }
        activeUID = nil
        streams = []
        isLoading = false
        revision = 0
    }

    private func schedulePersist(uid: String) {
        persistTask?.cancel()
        let snapshot = streams
        persistTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            StreamPersistence.save(streams: snapshot, uid: uid)
        }
    }

    var latestPlayAt: Date? {
        streams.first?.playedAt
    }

    func patchArtistArt(uid: String, updates: [(id: String, artistArt: String)]) async throws -> Int {
        try await patchFields(uid: uid, updates: updates.map { ($0.id, ["artistArt": $0.artistArt]) }) { record, value in
            guard let art = value["artistArt"] as? String else { return record }
            return record.replacing(artistArt: art)
        }
    }

    func patchAlbumArt(uid: String, updates: [(id: String, albumArt: String)]) async throws -> Int {
        try await patchFields(uid: uid, updates: updates.map { ($0.id, ["albumArt": $0.albumArt]) }) { record, value in
            guard let art = value["albumArt"] as? String else { return record }
            return record.replacing(albumArt: art)
        }
    }

    func patchDurations(uid: String, updates: [(id: String, durationMs: Int)]) async throws -> Int {
        try await patchFields(uid: uid, updates: updates.map { ($0.id, ["durationMs": $0.durationMs]) }) { record, value in
            guard let durationMs = value["durationMs"] as? Int else { return record }
            return record.replacing(durationMs: durationMs)
        }
    }

    private func patchFields(
        uid: String,
        updates: [(id: String, fields: [String: Any])],
        applyLocal: (StreamRecord, [String: Any]) -> StreamRecord
    ) async throws -> Int {
        guard !updates.isEmpty else { return 0 }

        let db = Firestore.firestore()
        var written = 0
        var batch = db.batch()
        var batchCount = 0
        let localByID = Dictionary(uniqueKeysWithValues: updates.map { ($0.id, $0.fields) })

        for update in updates {
            let ref = db.collection("users").document(uid).collection("streams").document(update.id)
            var data = update.fields
            data["updatedAt"] = Timestamp(date: Date())
            batch.setData(data, forDocument: ref, merge: true)
            batchCount += 1
            written += 1

            if batchCount >= 450 {
                try await batch.commit()
                batch = db.batch()
                batchCount = 0
            }
        }

        if batchCount > 0 {
            try await batch.commit()
        }

        var changed = false
        streams = streams.map { record in
            guard let fields = localByID[record.id] else { return record }
            let next = applyLocal(record, fields)
            if next != record { changed = true }
            return next
        }
        if changed {
            revision &+= 1
            schedulePersist(uid: uid)
        }

        return written
    }

    func writeStreams(uid: String, payloads: [SyncStreamPayload], skipExisting: Bool = true) async throws -> Int {
        let db = Firestore.firestore()
        var written = 0
        var merged: [StreamRecord] = []
        var batch = db.batch()
        var batchCount = 0

        for payload in payloads {
            guard let record = payload.toRecord(uid: uid) else { continue }
            let ref = db.collection("users").document(uid).collection("streams").document(record.id)
            if skipExisting {
                let existing = try await ref.getDocument()
                if existing.exists { continue }
            }
            batch.setData([
                "trackId": record.trackId,
                "trackName": record.trackName,
                "artistName": record.artistName,
                "artistArt": record.artistArt as Any,
                "albumName": record.albumName,
                "albumArt": record.albumArt as Any,
                "durationMs": record.durationMs,
                "playedAt": Timestamp(date: record.playedAt),
                "isDemo": record.isDemo,
                "createdAt": Timestamp(date: record.playedAt),
                "updatedAt": Timestamp(date: record.playedAt),
            ], forDocument: ref, merge: true)
            batchCount += 1
            written += 1
            merged.append(record)

            if batchCount >= 450 {
                try await batch.commit()
                batch = db.batch()
                batchCount = 0
            }
        }

        if batchCount > 0 {
            try await batch.commit()
        }

        if !merged.isEmpty {
            insertRecordsLocally(merged, uid: uid)
        }

        return written
    }

    /// Keep locally inserted rows until Firestore snapshot includes them.
    private static func mergeStreams(local: [StreamRecord], remote: [StreamRecord]) -> [StreamRecord] {
        var byID = Dictionary(uniqueKeysWithValues: remote.map { ($0.id, $0) })
        for record in local where byID[record.id] == nil {
            byID[record.id] = record
        }
        return byID.values.sorted { $0.playedAt > $1.playedAt }
    }

    private func insertRecordsLocally(_ records: [StreamRecord], uid: String) {
        var byID = Dictionary(uniqueKeysWithValues: streams.map { ($0.id, $0) })
        for record in records {
            byID[record.id] = record
        }
        let next = byID.values.sorted { $0.playedAt > $1.playedAt }
        let changed = next != streams
        streams = next
        if changed {
            revision &+= 1
            schedulePersist(uid: uid)
        }
    }

    private static func record(from document: QueryDocumentSnapshot) -> StreamRecord? {
        let data = document.data()
        guard
            let trackId = data["trackId"] as? String,
            let trackName = data["trackName"] as? String,
            let artistName = data["artistName"] as? String,
            let albumName = data["albumName"] as? String,
            let playedAt = (data["playedAt"] as? Timestamp)?.dateValue()
        else {
            return nil
        }

        return StreamRecord(
            id: document.documentID,
            trackId: trackId,
            trackName: trackName,
            artistName: artistName,
            artistArt: data["artistArt"] as? String,
            albumName: albumName,
            albumArt: data["albumArt"] as? String,
            durationMs: data["durationMs"] as? Int ?? 0,
            playedAt: playedAt,
            isDemo: data["isDemo"] as? Bool ?? false
        )
    }
}
