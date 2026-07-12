import SwiftUI
import FirebaseCore

enum FirebaseBootstrap {
    static func configureIfNeeded() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseBootstrap.configureIfNeeded()
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 200 * 1024 * 1024
        )
        return true
    }
}

@main
struct SoundfolioApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var authManager: AuthManager
    @State private var appState: AppState
    @State private var streamStore: StreamStore
    @State private var statsCache: StatsCache

    init() {
        FirebaseBootstrap.configureIfNeeded()
        _authManager = State(initialValue: AuthManager())
        _appState = State(initialValue: AppState(preferences: StatsPreferences()))
        _streamStore = State(initialValue: StreamStore())
        _statsCache = State(initialValue: StatsCache())
    }

    var body: some Scene {
        WindowGroup {
            RootView(preferences: appState.preferences)
                .environment(appState)
                .environment(authManager)
                .environment(streamStore)
                .environment(statsCache)
                .environment(appState.preferences)
                .onAppear {
                    appState.bindAuth(authManager)
                    appState.bindStreamStore(streamStore)
                }
        }
    }
}
