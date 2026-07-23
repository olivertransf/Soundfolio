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

    private var listener: ListenerRegistration?
    private var activeUID: String?
    private var persistTask: Task<Void, Never>?

    func start(uid: String) {
        guard activeUID != uid else { return }
        stop()
        activeUID = uid
        isLoading = true
        errorMessage = nil

        if let cached = StreamPersistence.load(uid: uid), !cached.isEmpty {
            streams = cached
            revision &+= 1
            isLoading = false
        }

        listener = Firestore.firestore()
            .collection("users")
            .document(uid)
            .collection("streams")
            .order(by: "playedAt", descending: true)
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    guard let self else { return }
                    self.isLoading = false
                    if let error {
                        self.errorMessage = error.localizedDescription
                        return
                    }
                    guard let documents = snapshot?.documents else {
                        self.streams = []
                        self.revision &+= 1
                        return
                    }
                    let remote = documents.compactMap { Self.record(from: $0) }
                    let next = Self.mergeStreams(local: self.streams, remote: remote)
                    // Include duration/art field updates — count/first-id alone misses backfills.
                    let changed = next != self.streams
                    self.streams = next
                    if changed {
                        self.revision &+= 1
                        self.schedulePersist(uid: uid)
                    }
                }
            }
    }

    /// One-shot fetch from Firestore. Pull-to-refresh uses this — not Last.fm.
    func reloadFromServer() async throws {
        guard let uid = activeUID else {
            throw StreamStoreError.notStarted
        }
        errorMessage = nil
        let snapshot = try await Firestore.firestore()
            .collection("users")
            .document(uid)
            .collection("streams")
            .order(by: "playedAt", descending: true)
            .getDocuments()
        let remote = snapshot.documents.compactMap { Self.record(from: $0) }
        streams = remote
        revision &+= 1
        schedulePersist(uid: uid)
        isLoading = false
    }

    func stop() {
        listener?.remove()
        listener = nil
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
