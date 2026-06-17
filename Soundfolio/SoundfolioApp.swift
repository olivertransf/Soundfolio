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
        return true
    }
}

@main
struct SoundfolioApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var authManager: AuthManager
    @State private var appState: AppState
    @State private var streamStore: StreamStore

    init() {
        FirebaseBootstrap.configureIfNeeded()
        _authManager = State(initialValue: AuthManager())
        _appState = State(initialValue: AppState(preferences: StatsPreferences()))
        _streamStore = State(initialValue: StreamStore())
    }

    var body: some Scene {
        WindowGroup {
            RootView(preferences: appState.preferences)
                .environment(appState)
                .environment(authManager)
                .environment(streamStore)
                .onAppear {
                    appState.bindAuth(authManager)
                    appState.bindStreamStore(streamStore)
                    authManager.updateBaseURL(appState.preferences.baseURL)
                }
        }
    }
}
