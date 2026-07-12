import Foundation

@MainActor
@Observable
final class StatsCache {
    private var overviewByKey: [String: OverviewResponse] = [:]
    private var patternsByKey: [String: PatternsResponse] = [:]
    private var historyByKey: [String: [HistoryPoint]] = [:]
    private var topTracksByKey: [String: [TopTrackItem]] = [:]
    private var topArtistsByKey: [String: [TopArtistItem]] = [:]
    private var topAlbumsByKey: [String: [TopAlbumItem]] = [:]
    private var recentByKey: [String: [RecentStream]] = [:]
    private var trackDetailByKey: [String: TrackDetail] = [:]
    private var artistDetailByKey: [String: ArtistDetail] = [:]
    private var albumDetailByKey: [String: AlbumDetail] = [:]

    private var activeUID: String?
    private var lastPersistedRevision: Int?
    private var persistTask: Task<Void, Never>?

    private let maxEntriesPerBucket = 32

    func setActiveUser(_ uid: String?) {
        activeUID = uid
    }

    func clearForSignOut() {
        persistTask?.cancel()
        persistTask = nil
        if let activeUID {
            StatsPersistence.clear(uid: activeUID)
        }
        activeUID = nil
        lastPersistedRevision = nil
        invalidateAll()
    }

    func hydrate(uid: String, revision: Int) {
        activeUID = uid
        guard let snapshot = StatsPersistence.load(uid: uid),
              snapshot.revision == revision,
              snapshot.groupingVersion == StatsPersistence.Snapshot.currentGroupingVersion else { return }
        overviewByKey = snapshot.overviewByKey
        patternsByKey = snapshot.patternsByKey
        historyByKey = snapshot.historyByKey
        topTracksByKey = snapshot.topTracksByKey
        topArtistsByKey = snapshot.topArtistsByKey
        topAlbumsByKey = snapshot.topAlbumsByKey
        recentByKey = snapshot.recentByKey
        trackDetailByKey = snapshot.trackDetailByKey
        artistDetailByKey = snapshot.artistDetailByKey
        albumDetailByKey = snapshot.albumDetailByKey
        lastPersistedRevision = revision
    }

    func invalidateAll() {
        overviewByKey.removeAll()
        patternsByKey.removeAll()
        historyByKey.removeAll()
        topTracksByKey.removeAll()
        topArtistsByKey.removeAll()
        topAlbumsByKey.removeAll()
        recentByKey.removeAll()
        trackDetailByKey.removeAll()
        artistDetailByKey.removeAll()
        albumDetailByKey.removeAll()
    }

    func overview(streams: [StreamRecord], preferences: StatsPreferences, revision: Int) -> OverviewResponse {
        let key = baseKey(preferences: preferences, revision: revision, suffix: "overview")
        if let cached = overviewByKey[key] { return cached }
        let value = StatsEngine.buildOverview(streams: streams, preferences: preferences)
        store(&overviewByKey, key: key, value: value, revision: revision)
        return value
    }

    func patterns(streams: [StreamRecord], preferences: StatsPreferences, revision: Int) -> PatternsResponse {
        let key = baseKey(preferences: preferences, revision: revision, suffix: "patterns")
        if let cached = patternsByKey[key] { return cached }
        let value = StatsEngine.patterns(from: streams, preferences: preferences)
        store(&patternsByKey, key: key, value: value, revision: revision)
        return value
    }

    func historyPoints(streams: [StreamRecord], preferences: StatsPreferences, revision: Int) -> [HistoryPoint] {
        let key = baseKey(
            preferences: preferences,
            revision: revision,
            suffix: "history-weeks-minutes"
        )
        if let cached = historyByKey[key] { return cached }
        let value = StatsEngine.historyPoints(from: streams, preferences: preferences)
        store(&historyByKey, key: key, value: value, revision: revision)
        return value
    }

    func topTracks(
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int,
        limit: Int
    ) -> [TopTrackItem] {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = baseKey(
            preferences: preferences,
            revision: revision,
            suffix: "top-tracks-\(limit)-\(range.label)"
        )
        if let cached = topTracksByKey[key] { return cached }
        let value = StatsEngine.topTracks(from: streams, sort: preferences.sort, limit: limit, range: range)
        store(&topTracksByKey, key: key, value: value, revision: revision)
        return value
    }

    func topArtists(
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int,
        limit: Int
    ) -> [TopArtistItem] {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = baseKey(
            preferences: preferences,
            revision: revision,
            suffix: "top-artists-\(limit)-\(range.label)"
        )
        if let cached = topArtistsByKey[key] { return cached }
        let value = StatsEngine.topArtists(from: streams, sort: preferences.sort, limit: limit, range: range)
        store(&topArtistsByKey, key: key, value: value, revision: revision)
        return value
    }

    func topAlbums(
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int,
        limit: Int
    ) -> [TopAlbumItem] {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = baseKey(
            preferences: preferences,
            revision: revision,
            suffix: "top-albums-\(limit)-\(range.label)"
        )
        if let cached = topAlbumsByKey[key] { return cached }
        let value = StatsEngine.topAlbums(from: streams, sort: preferences.sort, limit: limit, range: range)
        store(&topAlbumsByKey, key: key, value: value, revision: revision)
        return value
    }

    func recentStreams(
        from streams: [StreamRecord],
        limit: Int,
        preferences: StatsPreferences?,
        revision: Int
    ) -> [RecentStream] {
        let suffix = preferences == nil ? "recent-\(limit)-all" : "recent-\(limit)-filtered"
        let key = baseKey(
            preferences: preferences ?? StatsPreferences(),
            revision: revision,
            suffix: suffix
        )
        if let cached = recentByKey[key] { return cached }
        let value = StatsEngine.recentStreams(from: streams, limit: limit, preferences: preferences)
        store(&recentByKey, key: key, value: value, revision: revision)
        return value
    }

    func trackDetail(
        name: String,
        artist: String,
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int
    ) -> TrackDetail {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = "\(revision)|\(range.label)|track|\(artist)|\(name)"
        if let cached = trackDetailByKey[key] { return cached }
        let value = StatsEngine.trackDetail(name: name, artist: artist, streams: streams, range: range)
        store(&trackDetailByKey, key: key, value: value, revision: revision)
        return value
    }

    func artistDetail(
        name: String,
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int
    ) -> ArtistDetail {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = "\(revision)|\(range.label)|\(preferences.sort.rawValue)|artist|\(name)"
        if let cached = artistDetailByKey[key] { return cached }
        let value = StatsEngine.artistDetail(name: name, streams: streams, range: range, sort: preferences.sort)
        store(&artistDetailByKey, key: key, value: value, revision: revision)
        return value
    }

    func albumDetail(
        name: String,
        artist: String,
        streams: [StreamRecord],
        preferences: StatsPreferences,
        revision: Int
    ) -> AlbumDetail {
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        let key = "\(revision)|\(range.label)|album|\(artist)|\(name)"
        if let cached = albumDetailByKey[key] { return cached }
        let value = StatsEngine.albumDetail(name: name, artist: artist, streams: streams, range: range)
        store(&albumDetailByKey, key: key, value: value, revision: revision)
        return value
    }

    private func baseKey(preferences: StatsPreferences, revision: Int, suffix: String) -> String {
        "\(revision)|\(preferences.period.rawValue)|\(preferences.customFrom)|\(preferences.customTo)|\(preferences.sort.rawValue)|\(suffix)"
    }

    private func store<T>(_ bucket: inout [String: T], key: String, value: T, revision: Int) {
        bucket[key] = value
        if bucket.count > maxEntriesPerBucket {
            if let oldest = bucket.keys.first {
                bucket.removeValue(forKey: oldest)
            }
        }
        schedulePersist(revision: revision)
    }

    private func schedulePersist(revision: Int) {
        guard let activeUID else { return }
        lastPersistedRevision = revision
        persistTask?.cancel()
        persistTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            let snapshot = StatsPersistence.Snapshot(
                groupingVersion: StatsPersistence.Snapshot.currentGroupingVersion,
                revision: revision,
                overviewByKey: overviewByKey,
                patternsByKey: patternsByKey,
                historyByKey: historyByKey,
                topTracksByKey: topTracksByKey,
                topArtistsByKey: topArtistsByKey,
                topAlbumsByKey: topAlbumsByKey,
                recentByKey: recentByKey,
                trackDetailByKey: trackDetailByKey,
                artistDetailByKey: artistDetailByKey,
                albumDetailByKey: albumDetailByKey
            )
            StatsPersistence.save(snapshot, uid: activeUID)
        }
    }
}
