import SwiftUI

struct LibraryView: View {
    @Environment(AppNavigation.self) private var navigation
    @Bindable var preferences: StatsPreferences
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                NavigationSplitView {
                    List(selection: sectionSelection) {
                        ForEach(LibrarySection.allCases) { section in
                            Text(section.title)
                                .font(SoundfolioFont.medium(14))
                                .tag(section)
                        }
                    }
                    .navigationTitle("Library")
                } detail: {
                    NavigationStack {
                        librarySectionContent
                            .navigationTitle(navigation.librarySection.title)
                            .navigationBarTitleDisplayMode(.inline)
                    }
                }
            } else {
                VStack(spacing: 0) {
                    sectionPicker
                        .padding(.horizontal, SoundfolioTheme.pagePadding)
                        .padding(.vertical, 8)
                    librarySectionContent
                }
                .navigationTitle("Library")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    private var sectionSelection: Binding<LibrarySection?> {
        Binding(
            get: { navigation.librarySection },
            set: { newValue in
                if let newValue {
                    navigation.librarySection = newValue
                }
            }
        )
    }

    @ViewBuilder
    private var librarySectionContent: some View {
        switch navigation.librarySection {
        case .recent:
            if horizontalSizeClass == .regular {
                HStack(alignment: .top, spacing: 12) {
                    RecentPlaysView(preferences: preferences, embedInLibrary: true)
                        .frame(maxWidth: .infinity)
                    PatternsView(preferences: preferences, embedInLibrary: true)
                        .frame(maxWidth: .infinity)
                }
            } else {
                RecentPlaysView(preferences: preferences, embedInLibrary: true)
            }
        case .rankings:
            RankingsTabView(preferences: preferences)
        case .patterns:
            PatternsView(preferences: preferences, embedInLibrary: true)
        }
    }

    private var sectionPicker: some View {
        SoundfolioSegmentedControl(
            title: nil,
            options: LibrarySection.allCases.map { ($0, $0.title) },
            selection: Bindable(navigation).librarySection
        )
    }
}

enum TopListKind: String, CaseIterable, Identifiable {
    case tracks
    case artists
    case albums

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tracks: "Tracks"
        case .artists: "Artists"
        case .albums: "Albums"
        }
    }
}

struct RankingsTabView: View {
    @Bindable var preferences: StatsPreferences
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var kind: TopListKind = .tracks
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @State private var tracks: [TopTrackItem] = []
    @State private var artists: [TopArtistItem] = []
    @State private var albums: [TopAlbumItem] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .rankings)

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: 12) {
                        column(title: "Tracks") {
                            ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
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
                        column(title: "Artists") {
                            ForEach(Array(artists.enumerated()), id: \.element.id) { index, artist in
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
                                    destination: ArtistDetailView(
                                        artistName: artist.artistName,
                                        preferences: preferences
                                    )
                                )
                            }
                        }
                        column(title: "Albums") {
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
                } else {
                    SoundfolioSegmentedControl(
                        title: nil,
                        options: TopListKind.allCases.map { ($0, $0.title) },
                        selection: $kind
                    )
                    switch kind {
                    case .tracks:
                        column(title: "Tracks") {
                            ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
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
                    case .artists:
                        column(title: "Artists") {
                            ForEach(Array(artists.enumerated()), id: \.element.id) { index, artist in
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
                                    destination: ArtistDetailView(
                                        artistName: artist.artistName,
                                        preferences: preferences
                                    )
                                )
                            }
                        }
                    case .albums:
                        column(title: "Albums") {
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
            .soundfolioPage()
        }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(streamStore.revision)"
    }

    private func column<Content: View>(title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        RankColumn(title: title, content: content)
    }

    private func load() async {
        loading = true
        defer { loading = false }
        let revision = streamStore.revision
        tracks = statsCache.topTracks(
            streams: streamStore.streams,
            preferences: preferences,
            revision: revision,
            limit: 50
        )
        artists = statsCache.topArtists(
            streams: streamStore.streams,
            preferences: preferences,
            revision: revision,
            limit: 50
        )
        albums = statsCache.topAlbums(
            streams: streamStore.streams,
            preferences: preferences,
            revision: revision,
            limit: 50
        )
    }
}
