import SwiftUI

struct TrackDetailView: View {
    let trackName: String
    let artistName: String
    @Bindable var preferences: StatsPreferences
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @State private var detail: TrackDetail?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var rangeLabel: String { StatsEngine.parseTimeRange(preferences: preferences).label }

    private var scoped: [StreamRecord] {
        streamStore.streams.filter {
            EntityNormalize.matches($0.trackName, trackName) && EntityNormalize.matches($0.artistName, artistName)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .patterns)
                if let detail {
                    hero(detail)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
                        StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
                        StatCard(label: "First play", value: shortDate(detail.firstPlayedAt), accent: accent)
                        StatCard(label: "Last play", value: shortDate(detail.lastPlayedAt), accent: accent)
                        StatCard(
                            label: "Rank",
                            value: detail.rank.map { "#\($0)" } ?? "—",
                            hint: "among tracks",
                            accent: accent
                        )
                        StatCard(label: "Share", value: "\(detail.share)%", hint: "of minutes", accent: accent)
                    }
                    playsOverTime
                    playsByHour
                    if !detail.recentPlays.isEmpty {
                        RankColumn(title: "Recent plays") {
                            VStack(spacing: 0) {
                                ForEach(detail.recentPlays) { play in
                                    HStack(spacing: 12) {
                                        if let date = parseISO8601(play.playedAt) {
                                            Text(formatPlayTime(date, preference: preferences.timeDisplay))
                                                .font(SoundfolioTheme.captionFont)
                                                .foregroundStyle(SoundfolioTheme.mutedForeground)
                                                .frame(width: 72, alignment: .leading)
                                        }
                                        Text(play.albumName ?? detail.albumName)
                                            .font(SoundfolioTheme.rowTitleFont)
                                            .lineLimit(1)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, SoundfolioTheme.rowVerticalPadding(from: preferences))
                                }
                            }
                        }
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(trackName)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { load() }
    }

    private var reloadID: String {
        "\(trackName)-\(artistName)-\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(streamStore.revision)"
    }

    private var playsOverTime: some View {
        let grain = historyGrain(preferences)
        let points = StatsEngine.historySeries(from: scoped, preferences: preferences, grain: grain)
        return ChartPanel(
            title: ChartCopy.historyTitle(grain: grain, metric: "Plays"),
            caption: ChartCopy.caption(range: rangeLabel, metric: "Plays")
        ) {
            SeriesChart(points: points, metricLabel: "Plays", useMinutes: false, accent: accent)
        }
    }

    private var playsByHour: some View {
        let points = StatsEngine.patterns(from: scoped, preferences: preferences).byHour.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return ChartPanel(
            title: "Plays by hour",
            caption: ChartCopy.caption(range: rangeLabel, metric: "Plays")
        ) {
            SeriesChart(points: points, metricLabel: "Plays", useMinutes: false, accent: accent)
        }
    }

    private func hero(_ detail: TrackDetail) -> some View {
        HStack(spacing: 16) {
            ArtworkView(urlString: detail.albumArt, size: 112, cornerRadius: 12)
            VStack(alignment: .leading, spacing: 4) {
                Text("TRACK")
                    .font(SoundfolioFont.semibold(10))
                    .tracking(0.6)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                Text(detail.trackName)
                    .font(SoundfolioFont.semibold(22))
                Text(detail.artistName)
                    .font(SoundfolioTheme.rowSubtitleFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                Text(detail.albumName)
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            }
        }
        .soundfolioPanel(preferences: preferences)
    }

    private func load() {
        detail = statsCache.trackDetail(
            name: trackName,
            artist: artistName,
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision
        )
    }
}

struct ArtistDetailView: View {
    let artistName: String
    @Bindable var preferences: StatsPreferences
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var detail: ArtistDetail?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var rangeLabel: String { StatsEngine.parseTimeRange(preferences: preferences).label }

    private var scoped: [StreamRecord] {
        streamStore.streams.filter { EntityNormalize.matches($0.artistName, artistName) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .patterns)
                if let detail {
                    HStack(spacing: 16) {
                        ArtworkView(urlString: detail.artistArt, size: 112, isCircle: true, letterFallback: String(detail.artistName.prefix(1)).uppercased())
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ARTIST")
                                .font(SoundfolioFont.semibold(10))
                                .tracking(0.6)
                                .foregroundStyle(SoundfolioTheme.mutedForeground)
                            Text(detail.artistName)
                                .font(SoundfolioFont.semibold(22))
                        }
                    }
                    .soundfolioPanel(preferences: preferences)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
                        StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
                        StatCard(label: "Tracks", value: detail.uniqueTracks.formatted(), accent: accent)
                        StatCard(label: "Albums", value: detail.uniqueAlbums.formatted(), accent: accent)
                        StatCard(label: "Share", value: "\(detail.share)%", hint: "of minutes", accent: accent)
                    }

                    listeningOverTime
                    weekdayChart
                    topTrackChart(detail)

                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 12) {
                            rankedSection(title: "Top tracks", tracks: detail.topTracks)
                            rankedSection(title: "Top albums", albums: detail.topAlbums)
                        }
                    } else {
                        rankedSection(title: "Top tracks", tracks: detail.topTracks)
                        rankedSection(title: "Top albums", albums: detail.topAlbums)
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(artistName)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { load() }
    }

    private var reloadID: String {
        "\(artistName)-\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(streamStore.revision)"
    }

    private var listeningOverTime: some View {
        let grain = historyGrain(preferences)
        let points = StatsEngine.historySeries(from: scoped, preferences: preferences, grain: grain)
        return ChartPanel(
            title: ChartCopy.historyTitle(grain: grain, metric: "Minutes"),
            caption: ChartCopy.caption(range: rangeLabel, metric: "Minutes")
        ) {
            SeriesChart(points: points, metricLabel: "Minutes", useMinutes: true, accent: accent)
        }
    }

    private var weekdayChart: some View {
        let points = StatsEngine.patterns(from: scoped, preferences: preferences).byDay.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return ChartPanel(
            title: "Minutes by weekday",
            caption: ChartCopy.caption(range: rangeLabel, metric: "Minutes")
        ) {
            SeriesChart(points: points, metricLabel: "Minutes", useMinutes: true, accent: accent)
        }
    }

    private func topTrackChart(_ detail: ArtistDetail) -> some View {
        let points = detail.topTracks.map {
            HistoryPoint(label: $0.trackName, minutes: $0.minutesListened, streams: $0.streams)
        }
        return ChartPanel(
            title: "Minutes by track",
            caption: ChartCopy.caption(range: rangeLabel, metric: "Minutes")
        ) {
            SeriesChart(points: points, metricLabel: "Minutes", useMinutes: true, accent: accent)
        }
    }

    @ViewBuilder
    private func rankedSection(title: String, tracks: [TopTrackItem]) -> some View {
        if !tracks.isEmpty {
            RankColumn(title: title) {
                VStack(spacing: 0) {
                    ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                        RankedRow(
                            rank: index + 1,
                            title: track.trackName,
                            subtitle: track.albumName,
                            value: RankValueFormatter.primary(
                                minutes: track.minutesListened,
                                streams: track.streams,
                                sort: preferences.sort
                            ),
                            artworkURL: track.albumArt,
                            destination: TrackDetailView(
                                trackName: track.trackName,
                                artistName: track.artistName,
                                preferences: preferences
                            )
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func rankedSection(title: String, albums: [TopAlbumItem]) -> some View {
        if !albums.isEmpty {
            RankColumn(title: title) {
                VStack(spacing: 0) {
                    ForEach(Array(albums.enumerated()), id: \.element.id) { index, album in
                        RankedRow(
                            rank: index + 1,
                            title: album.albumName,
                            subtitle: album.artistName,
                            value: RankValueFormatter.primary(
                                minutes: album.minutesListened,
                                streams: album.streams,
                                sort: preferences.sort
                            ),
                            artworkURL: album.albumArt,
                            destination: AlbumDetailView(
                                albumName: album.albumName,
                                artistName: album.artistName,
                                preferences: preferences
                            )
                        )
                    }
                }
            }
        }
    }

    private func load() {
        detail = statsCache.artistDetail(
            name: artistName,
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision
        )
    }
}

struct AlbumDetailView: View {
    let albumName: String
    let artistName: String
    @Bindable var preferences: StatsPreferences
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @State private var detail: AlbumDetail?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var rangeLabel: String { StatsEngine.parseTimeRange(preferences: preferences).label }

    private var scoped: [StreamRecord] {
        streamStore.streams.filter {
            EntityNormalize.matches($0.albumName, albumName) && EntityNormalize.matches($0.artistName, artistName)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .patterns)
                if let detail {
                    HStack(spacing: 16) {
                        ArtworkView(urlString: detail.albumArt, size: 112, cornerRadius: 12)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ALBUM")
                                .font(SoundfolioFont.semibold(10))
                                .tracking(0.6)
                                .foregroundStyle(SoundfolioTheme.mutedForeground)
                            Text(detail.albumName)
                                .font(SoundfolioFont.semibold(22))
                            Text(detail.artistName)
                                .font(SoundfolioTheme.rowSubtitleFont)
                                .foregroundStyle(SoundfolioTheme.mutedForeground)
                        }
                    }
                    .soundfolioPanel(preferences: preferences)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                        StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
                        StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
                        StatCard(label: "Tracks heard", value: detail.tracks.count.formatted(), accent: accent)
                        StatCard(label: "Share", value: "\(detail.share)%", hint: "of minutes", accent: accent)
                    }

                    minutesPerTrack(detail)
                    listeningOverTime

                    RankColumn(title: "Tracks") {
                        VStack(spacing: 0) {
                            ForEach(Array(detail.tracks.enumerated()), id: \.element.id) { index, track in
                                RankedRow(
                                    rank: index + 1,
                                    title: track.trackName,
                                    subtitle: "",
                                    value: RankValueFormatter.primary(
                                        minutes: track.minutes,
                                        streams: track.streams,
                                        sort: preferences.sort
                                    ),
                                    artworkURL: detail.albumArt,
                                    destination: TrackDetailView(
                                        trackName: track.trackName,
                                        artistName: detail.artistName,
                                        preferences: preferences
                                    )
                                )
                            }
                        }
                    }
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(albumName)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { load() }
    }

    private var reloadID: String {
        "\(albumName)-\(artistName)-\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(streamStore.revision)"
    }

    private func minutesPerTrack(_ detail: AlbumDetail) -> some View {
        let points = detail.tracks
            .sorted { $0.minutes > $1.minutes }
            .map { HistoryPoint(label: $0.trackName, minutes: $0.minutes, streams: $0.streams) }
        return ChartPanel(
            title: "Minutes by track",
            caption: ChartCopy.caption(range: rangeLabel, metric: "Minutes")
        ) {
            SeriesChart(points: points, metricLabel: "Minutes", useMinutes: true, accent: accent)
        }
    }

    private var listeningOverTime: some View {
        let grain = historyGrain(preferences)
        let points = StatsEngine.historySeries(from: scoped, preferences: preferences, grain: grain)
        return ChartPanel(
            title: ChartCopy.historyTitle(grain: grain, metric: "Minutes"),
            caption: ChartCopy.caption(range: rangeLabel, metric: "Minutes")
        ) {
            SeriesChart(points: points, metricLabel: "Minutes", useMinutes: true, accent: accent)
        }
    }

    private func load() {
        detail = statsCache.albumDetail(
            name: albumName,
            artist: artistName,
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision
        )
    }
}

private func historyGrain(_ preferences: StatsPreferences) -> HistoryGrain {
    let range = StatsEngine.parseTimeRange(preferences: preferences)
    guard let since = range.since, let until = range.until else { return .months }
    let days = Calendar.current.dateComponents([.day], from: since, to: until).day ?? 0
    if days > 400 { return .months }
    if days > 120 { return .weeks }
    return .days
}

private func shortDate(_ date: Date?) -> String {
    guard let date else { return "—" }
    return date.formatted(date: .abbreviated, time: .omitted)
}
