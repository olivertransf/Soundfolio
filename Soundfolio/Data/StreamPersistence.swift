import Foundation

enum StreamPersistence {
    private static var directoryURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = base.appendingPathComponent("Soundfolio", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private static func fileURL(uid: String) -> URL {
        directoryURL.appendingPathComponent("streams-\(uid).json")
    }

    struct PersistedStream: Codable {
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
    }

    static func save(streams: [StreamRecord], uid: String) {
        let payload = streams.map {
            PersistedStream(
                id: $0.id,
                trackId: $0.trackId,
                trackName: $0.trackName,
                artistName: $0.artistName,
                artistArt: $0.artistArt,
                albumName: $0.albumName,
                albumArt: $0.albumArt,
                durationMs: $0.durationMs,
                playedAt: $0.playedAt,
                isDemo: $0.isDemo
            )
        }
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: fileURL(uid: uid), options: .atomic)
    }

    static func load(uid: String) -> [StreamRecord]? {
        let url = fileURL(uid: uid)
        guard let data = try? Data(contentsOf: url) else { return nil }
        guard let payload = try? JSONDecoder().decode([PersistedStream].self, from: data) else { return nil }
        return payload.map {
            StreamRecord(
                id: $0.id,
                trackId: $0.trackId,
                trackName: $0.trackName,
                artistName: $0.artistName,
                artistArt: $0.artistArt,
                albumName: $0.albumName,
                albumArt: $0.albumArt,
                durationMs: $0.durationMs,
                playedAt: $0.playedAt,
                isDemo: $0.isDemo
            )
        }
    }

    static func clear(uid: String) {
        try? FileManager.default.removeItem(at: fileURL(uid: uid))
    }
}
