import SwiftUI
import FirebaseAuth

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var auth
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Bindable var preferences: StatsPreferences
    @State private var navigation = AppNavigation()
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase

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
            } else {
                TabView(selection: Bindable(navigation).selectedTab) {
                    NavigationStack {
                        DashboardView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.dashboard.title, systemImage: AppTab.dashboard.systemImage) }
                    .tag(AppTab.dashboard)

                    Group {
                        if horizontalSizeClass == .regular {
                            LibraryView(preferences: preferences)
                        } else {
                            NavigationStack {
                                LibraryView(preferences: preferences)
                            }
                        }
                    }
                    .tabItem { Label(AppTab.library.title, systemImage: AppTab.library.systemImage) }
                    .tag(AppTab.library)

                    NavigationStack {
                        SettingsView(preferences: preferences)
                    }
                    .tabItem { Label(AppTab.settings.title, systemImage: AppTab.settings.systemImage) }
                    .tag(AppTab.settings)
                }
                .tabViewStyle(.sidebarAdaptable)
            }
        }
        .environment(navigation)
        .tint(SoundfolioTheme.accent(from: preferences))
        .preferredColorScheme(preferences.preferredColorScheme)
        .background(SoundfolioTheme.pageBackground.ignoresSafeArea())
        .task(id: auth.isSignedIn && !auth.needsOnboarding) {
            guard auth.isSignedIn, !auth.needsOnboarding, let uid = auth.user?.uid else {
                streamStore.stop()
                statsCache.clearForSignOut()
                return
            }
            statsCache.setActiveUser(uid)
            streamStore.start(uid: uid)
            statsCache.hydrate(uid: uid, revision: streamStore.revision)
            appState.refreshFreshness(from: streamStore)
        }
        .onChange(of: streamStore.latestPlayAt) { _, newValue in
            appState.latestPlayAt = newValue
            appState.freshnessCheckedAt = Date()
        }
        .onChange(of: streamStore.revision) { oldRevision, newRevision in
            guard newRevision != oldRevision else { return }
            if oldRevision == 0, let uid = auth.user?.uid {
                statsCache.hydrate(uid: uid, revision: newRevision)
                return
            }
            guard !appState.isSyncing else { return }
            statsCache.invalidateAll()
        }
        .onChange(of: appState.isSyncing) { wasSyncing, isSyncing in
            if wasSyncing, !isSyncing {
                statsCache.invalidateAll()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                appState.setSyncBackgrounded(true)
            case .active:
                appState.setSyncBackgrounded(false)
            default:
                break
            }
        }
    }
}
