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
                            Label(section.title, systemImage: section.systemImage)
                                .tag(section)
                        }
                    }
                    .navigationTitle("Library")
                } detail: {
                    NavigationStack {
                        librarySectionContent
                            .navigationTitle(navigation.librarySection.title)
                            .navigationBarTitleDisplayMode(.large)
                    }
                }
            } else {
                VStack(spacing: 0) {
                    sectionPicker
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
            RecentPlaysView(preferences: preferences, embedInLibrary: true)
        case .rankings:
            RankingsTabView(preferences: preferences)
        case .patterns:
            PatternsView(preferences: preferences, embedInLibrary: true)
        }
    }

    private var sectionPicker: some View {
        Picker("Section", selection: Bindable(navigation).librarySection) {
            ForEach(LibrarySection.allCases) { section in
                Text(section.title).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, SoundfolioTheme.pagePadding)
        .padding(.vertical, 8)
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

    var body: some View {
        VStack(spacing: 0) {
            Picker("List", selection: $kind) {
                ForEach(TopListKind.allCases) { k in
                    Text(k.title).tag(k)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, SoundfolioTheme.pagePadding(for: horizontalSizeClass))
            .padding(.bottom, 8)

            Group {
                switch kind {
                case .tracks:
                    TopTracksView(embedInNavigation: false, preferences: preferences)
                case .artists:
                    TopArtistsView(embedInNavigation: false, preferences: preferences)
                case .albums:
                    TopAlbumsView(embedInNavigation: false, preferences: preferences)
                }
            }
        }
    }
}
