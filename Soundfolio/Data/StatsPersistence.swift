import Foundation

enum StatsPersistence {
    private static var directoryURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = base.appendingPathComponent("Soundfolio", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private static func fileURL(uid: String) -> URL {
        directoryURL.appendingPathComponent("stats-\(uid).json")
    }

    struct Snapshot: Codable {
        static let currentGroupingVersion = 2

        let groupingVersion: Int
        let revision: Int
        let overviewByKey: [String: OverviewResponse]
        let patternsByKey: [String: PatternsResponse]
        let historyByKey: [String: [HistoryPoint]]
        let topTracksByKey: [String: [TopTrackItem]]
        let topArtistsByKey: [String: [TopArtistItem]]
        let topAlbumsByKey: [String: [TopAlbumItem]]
        let recentByKey: [String: [RecentStream]]
        let trackDetailByKey: [String: TrackDetail]
        let artistDetailByKey: [String: ArtistDetail]
        let albumDetailByKey: [String: AlbumDetail]
    }

    static func save(_ snapshot: Snapshot, uid: String) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: fileURL(uid: uid), options: .atomic)
    }

    static func load(uid: String) -> Snapshot? {
        let url = fileURL(uid: uid)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    static func clear(uid: String) {
        try? FileManager.default.removeItem(at: fileURL(uid: uid))
    }
}
