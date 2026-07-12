import SwiftUI

struct TopTracksView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopTrackItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Tracks",
            embedInNavigation: embedInNavigation,
            preferences: preferences,
            loading: loading,
            error: error,
            onRetry: { Task { await load() } }
        ) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, track in
                RankedRow(
                    rank: index + 1,
                    title: track.trackName,
                    subtitle: track.artistName,
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
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.revision)"
    }

    private func load() async {
        loading = true
        error = nil
        items = statsCache.topTracks(
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision,
            limit: 50
        )
        loading = false
    }
}

struct TopArtistsView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopArtistItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Artists",
            embedInNavigation: embedInNavigation,
            preferences: preferences,
            loading: loading,
            error: error,
            onRetry: { Task { await load() } }
        ) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, artist in
                RankedRow(
                    rank: index + 1,
                    title: artist.artistName,
                    subtitle: "",
                    value: RankValueFormatter.primary(
                        minutes: artist.minutesListened,
                        streams: artist.streams,
                        sort: preferences.sort
                    ),
                    artworkURL: artist.artistArt,
                    isCircleArt: true,
                    destination: ArtistDetailView(artistName: artist.artistName, preferences: preferences)
                )
            }
        }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.revision)"
    }

    private func load() async {
        loading = true
        error = nil
        items = statsCache.topArtists(
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision,
            limit: 50
        )
        loading = false
    }
}

struct TopAlbumsView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopAlbumItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Albums",
            embedInNavigation: embedInNavigation,
            preferences: preferences,
            loading: loading,
            error: error,
            onRetry: { Task { await load() } }
        ) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, album in
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
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.revision)"
    }

    private func load() async {
        loading = true
        error = nil
        items = statsCache.topAlbums(
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision,
            limit: 50
        )
        loading = false
    }
}

private struct TopListContainer<Rows: View>: View {
    let title: String
    var embedInNavigation = true
    @Bindable var preferences: StatsPreferences
    let loading: Bool
    let error: String?
    let onRetry: () -> Void
    @ViewBuilder var rows: () -> Rows

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if !embedInNavigation {
                    FilterToolbar(preferences: preferences, context: .rankings)
                }

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if let error {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(SoundfolioTheme.rowSubtitleFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                        Button("Retry", action: onRetry).buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120)
                } else {
                    RankColumn(title: title) {
                        VStack(spacing: 0) { rows() }
                    }
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(embedInNavigation ? title : "")
        .navigationBarTitleDisplayMode(.inline)
    }
}
