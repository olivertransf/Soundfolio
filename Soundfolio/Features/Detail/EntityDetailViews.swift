import SwiftUI

struct TrackDetailView: View {
    let trackName: String
    let artistName: String
    @Bindable var preferences: StatsPreferences
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var detail: TrackDetail?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if let detail {
                    hero(detail)
                    statsRow(detail)
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
        "\(trackName)-\(artistName)-\(preferences.period.rawValue)-\(streamStore.revision)"
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

    private func statsRow(_ detail: TrackDetail) -> some View {
        HStack(spacing: 8) {
            StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
            StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
        }
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
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
                            Text(
                                RankValueFormatter.primary(
                                    minutes: detail.minutesListened,
                                    streams: detail.streams,
                                    sort: preferences.sort
                                )
                            )
                            .font(SoundfolioTheme.captionFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                        }
                    }
                    .soundfolioPanel(preferences: preferences)

                    HStack(spacing: 8) {
                        StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
                        StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
                    }

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
        "\(artistName)-\(preferences.period.rawValue)-\(streamStore.revision)"
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
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

                    HStack(spacing: 8) {
                        StatCard(label: "Plays", value: detail.streams.formatted(), accent: accent)
                        StatCard(label: "Minutes", value: detail.minutesListened.formatted(), accent: accent)
                    }

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
        "\(albumName)-\(artistName)-\(preferences.period.rawValue)-\(streamStore.revision)"
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
