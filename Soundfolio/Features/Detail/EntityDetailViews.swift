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
                    header(detail)
                    statsRow(detail)
                    if !detail.recentPlays.isEmpty {
                        SectionHeader(title: "Recent plays in period")
                        VStack(spacing: 0) {
                            ForEach(detail.recentPlays) { play in
                                HStack(spacing: 12) {
                                    if let date = parseISO8601(play.playedAt) {
                                        Text(formattedDate(date))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .frame(width: 88, alignment: .leading)
                                    }
                                    Text(play.albumName ?? detail.albumName)
                                        .font(.subheadline)
                                        .lineLimit(1)
                                    Spacer()
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .soundfolioCard()
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

    @ViewBuilder
    private func header(_ detail: TrackDetail) -> some View {
        HStack(spacing: 16) {
            ArtworkView(urlString: detail.albumArt, size: 96)
            VStack(alignment: .leading, spacing: 4) {
                Text(detail.trackName)
                    .font(.title3.weight(.semibold))
                Text(detail.artistName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(detail.albumName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func statsRow(_ detail: TrackDetail) -> some View {
        if horizontalSizeClass == .regular {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                StatCard(label: "Plays", value: detail.streams.formatted(), systemImage: "play.fill", accent: accent)
                StatCard(label: "Minutes", value: detail.minutesListened.formatted(), systemImage: "clock.fill", accent: accent)
            }
        } else {
            HStack(spacing: 8) {
                StatCard(label: "Plays", value: detail.streams.formatted(), systemImage: "play.fill", accent: accent)
                StatCard(label: "Minutes", value: detail.minutesListened.formatted(), systemImage: "clock.fill", accent: accent)
            }
        }
        if let first = detail.firstPlayedAt, let last = detail.lastPlayedAt {
            Text("First: \(formattedDate(first)) · Last: \(formattedDate(last))")
                .font(.caption)
                .foregroundStyle(.secondary)
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

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct ArtistDetailView: View {
    let artistName: String
    @Bindable var preferences: StatsPreferences
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var detail: ArtistDetail?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if let detail {
                    HStack(spacing: 16) {
                        ArtworkView(urlString: detail.artistArt, size: 96, isCircle: true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(detail.artistName)
                                .font(.title3.weight(.semibold))
                            Text("\(detail.streams.formatted()) plays · \(detail.minutesListened.formatted()) min")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 16) {
                            rankedSection(title: "Top tracks", tracks: detail.topTracks)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            rankedSection(title: "Top albums", albums: detail.topAlbums)
                                .frame(maxWidth: .infinity, alignment: .leading)
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
            SectionHeader(title: title)
            rankedContainer {
                ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                    RankedRow(
                        rank: index + 1,
                        title: track.trackName,
                        subtitle: track.albumName,
                        value: RankValueFormatter.primary(minutes: track.minutesListened, streams: track.streams, sort: preferences.sort),
                        artworkURL: track.albumArt,
                        destination: TrackDetailView(trackName: track.trackName, artistName: track.artistName, preferences: preferences)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func rankedSection(title: String, albums: [TopAlbumItem]) -> some View {
        if !albums.isEmpty {
            SectionHeader(title: title)
            rankedContainer {
                ForEach(Array(albums.enumerated()), id: \.element.id) { index, album in
                    RankedRow(
                        rank: index + 1,
                        title: album.albumName,
                        subtitle: album.artistName,
                        value: RankValueFormatter.primary(minutes: album.minutesListened, streams: album.streams, sort: preferences.sort),
                        artworkURL: album.albumArt,
                        destination: AlbumDetailView(albumName: album.albumName, artistName: album.artistName, preferences: preferences)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func rankedContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        if horizontalSizeClass == .regular {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 0) {
                content()
            }
            .soundfolioCard()
        } else {
            VStack(spacing: 0) { content() }
                .soundfolioCard()
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var detail: AlbumDetail?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if let detail {
                    HStack(spacing: 16) {
                        ArtworkView(urlString: detail.albumArt, size: 96)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(detail.albumName)
                                .font(.title3.weight(.semibold))
                            Text(detail.artistName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text("\(detail.streams.formatted()) plays · \(detail.minutesListened.formatted()) min")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    SectionHeader(title: "Tracks")
                    Group {
                        if horizontalSizeClass == .regular {
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 0) {
                                albumTrackRows(detail)
                            }
                        } else {
                            VStack(spacing: 0) {
                                albumTrackRows(detail)
                            }
                        }
                    }
                    .soundfolioCard()
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

    @ViewBuilder
    private func albumTrackRows(_ detail: AlbumDetail) -> some View {
        ForEach(Array(detail.tracks.enumerated()), id: \.element.id) { index, track in
            RankedRow(
                rank: index + 1,
                title: track.trackName,
                subtitle: "\(track.streams.formatted()) plays",
                value: "\(track.minutes.formatted()) min",
                artworkURL: detail.albumArt,
                destination: TrackDetailView(trackName: track.trackName, artistName: detail.artistName, preferences: preferences)
            )
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
