import Foundation
import FirebaseFirestore

@MainActor
@Observable
final class StreamStore {
    private(set) var streams: [StreamRecord] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var listener: ListenerRegistration?
    private var activeUID: String?

    func start(uid: String) {
        guard activeUID != uid else { return }
        stop()
        activeUID = uid
        isLoading = true
        errorMessage = nil

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
                        return
                    }
                    self.streams = documents.compactMap { Self.record(from: $0) }
                }
            }
    }

    func stop() {
        listener?.remove()
        listener = nil
        activeUID = nil
        streams = []
        isLoading = false
    }

    var latestPlayAt: Date? {
        streams.first?.playedAt
    }

    func writeStreams(uid: String, payloads: [SyncStreamPayload], skipExisting: Bool = true) async throws -> Int {
        let db = Firestore.firestore()
        var written = 0
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

            if batchCount >= 450 {
                try await batch.commit()
                batch = db.batch()
                batchCount = 0
            }
        }

        if batchCount > 0 {
            try await batch.commit()
        }

        return written
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
