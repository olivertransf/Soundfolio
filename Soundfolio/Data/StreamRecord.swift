import Foundation

struct StreamRecord: Identifiable, Hashable {
    let id: String
    let trackId: String
    let trackName: String
    let artistName: String
    let artistArt: String?
    let albumName: String
    let albumArt: String?
    let durationMs: Int
    let playedAt: Date
    let isDemo: Bool

    static func documentId(uid: String, trackId: String, playedAt: Date) -> String {
        "\(uid)__\(trackId)__\(Int(playedAt.timeIntervalSince1970 * 1000))"
    }
}

struct SyncStreamPayload: Codable {
    let trackId: String
    let trackName: String
    let artistName: String
    let artistArt: String?
    let albumName: String
    let albumArt: String?
    let durationMs: Int
    let playedAt: String
    let isDemo: Bool
}

extension SyncStreamPayload {
    func toRecord(uid: String) -> StreamRecord? {
        guard let date = parseISO8601(playedAt) else { return nil }
        return StreamRecord(
            id: StreamRecord.documentId(uid: uid, trackId: trackId, playedAt: date),
            trackId: trackId,
            trackName: trackName,
            artistName: artistName,
            artistArt: artistArt,
            albumName: albumName,
            albumArt: albumArt,
            durationMs: durationMs,
            playedAt: date,
            isDemo: isDemo
        )
    }
}
