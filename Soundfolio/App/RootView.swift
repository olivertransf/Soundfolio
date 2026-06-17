import SwiftUI

enum AppTab: String, CaseIterable, Hashable {
    case overview
    case recent
    case tops
    case patterns
    case settings

    var title: String {
        switch self {
        case .overview: "Home"
        case .recent: "Recent"
        case .tops: "Tops"
        case .patterns: "Patterns"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .overview: "chart.bar.fill"
        case .recent: "clock.fill"
        case .tops: "music.note.list"
        case .patterns: "waveform"
        case .settings: "gearshape.fill"
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var auth
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    @State private var tab: AppTab = .overview

    private var needsSetup: Bool {
        preferences.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView("Loading account...")
            } else if !auth.isSignedIn {
                NavigationStack {
                    AuthView()
                }
            } else if auth.needsOnboarding {
                NavigationStack {
                    OnboardingView()
                }
            } else if needsSetup {
                NavigationStack {
                    SetupRequiredView(preferences: preferences)
                }
            } else {
                TabView(selection: $tab) {
                    NavigationStack {
                        OverviewView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.overview.title, systemImage: AppTab.overview.systemImage) }
                    .tag(AppTab.overview)

                    NavigationStack {
                        RecentPlaysView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.recent.title, systemImage: AppTab.recent.systemImage) }
                    .tag(AppTab.recent)

                    NavigationStack {
                        TopsTabView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.tops.title, systemImage: AppTab.tops.systemImage) }
                    .tag(AppTab.tops)

                    NavigationStack {
                        PatternsView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.patterns.title, systemImage: AppTab.patterns.systemImage) }
                    .tag(AppTab.patterns)

                    NavigationStack {
                        SettingsView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.settings.title, systemImage: AppTab.settings.systemImage) }
                    .tag(AppTab.settings)
                }
            }
        }
        .tint(SoundfolioTheme.accent(from: preferences))
        .preferredColorScheme(preferences.preferredColorScheme)
        .onChange(of: preferences.baseURL) { _, newValue in
            auth.updateBaseURL(newValue)
            appState.reloadClient()
        }
        .task(id: auth.isSignedIn && !auth.needsOnboarding) {
            guard auth.isSignedIn, !auth.needsOnboarding, !needsSetup, let uid = auth.user?.uid else {
                streamStore.stop()
                return
            }
            streamStore.start(uid: uid)
            appState.refreshFreshness(from: streamStore)
        }
        .onChange(of: streamStore.latestPlayAt) { _, newValue in
            appState.latestPlayAt = newValue
            appState.freshnessCheckedAt = Date()
        }
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

struct TopsTabView: View {
    @Bindable var preferences: StatsPreferences
    @State private var kind: TopListKind = .tracks

    var body: some View {
        VStack(spacing: 0) {
            Picker("List", selection: $kind) {
                ForEach(TopListKind.allCases) { k in
                    Text(k.title).tag(k)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.vertical, 8)

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
        .navigationTitle("Tops")
        .navigationBarTitleDisplayMode(.inline)
    }
}
