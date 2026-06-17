import SwiftUI

struct TopTracksView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopTrackItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Top tracks",
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
                    value: preferences.sort == .streams ? "\(track.streams.formatted())×" : "\(track.minutesListened.formatted()) min",
                    artworkURL: track.albumArt
                )
            }
        }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.streams.count)"
    }

    private func load() async {
        loading = true
        error = nil
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        items = StatsEngine.topTracks(from: streamStore.streams, sort: preferences.sort, limit: 50, range: range)
        loading = false
    }
}

struct TopArtistsView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopArtistItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Top artists",
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
                    subtitle: preferences.sort == .streams ? "\(artist.minutesListened) min" : "\(artist.streams) plays",
                    value: preferences.sort == .streams ? "\(artist.streams.formatted())×" : "\(artist.minutesListened.formatted()) min",
                    artworkURL: artist.artistArt,
                    isCircleArt: true
                )
            }
        }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.streams.count)"
    }

    private func load() async {
        loading = true
        error = nil
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        items = StatsEngine.topArtists(from: streamStore.streams, sort: preferences.sort, limit: 50, range: range)
        loading = false
    }
}

struct TopAlbumsView: View {
    var embedInNavigation = true
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    @State private var items: [TopAlbumItem] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        TopListContainer(
            title: "Top albums",
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
                    value: preferences.sort == .streams ? "\(album.streams.formatted())×" : "\(album.minutesListened.formatted()) min",
                    artworkURL: album.albumArt
                )
            }
        }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.streams.count)"
    }

    private func load() async {
        loading = true
        error = nil
        let range = StatsEngine.parseTimeRange(preferences: preferences)
        items = StatsEngine.topAlbums(from: streamStore.streams, sort: preferences.sort, limit: 50, range: range)
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

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if !embedInNavigation {
                    StatsFiltersBar(preferences: preferences)
                }

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if let error {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Retry", action: onRetry).buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120)
                } else {
                    listContent
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(embedInNavigation ? title : "")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var listContent: some View {
        if sizeClass == .regular {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 0) {
                rows()
            }
            .soundfolioCard()
        } else {
            VStack(spacing: 0) { rows() }.soundfolioCard()
        }
    }
}
