import SwiftUI

@main
struct SoundfolioApp: App {
    @State private var appState = AppState(preferences: StatsPreferences())

    var body: some Scene {
        WindowGroup {
            RootView(preferences: appState.preferences)
                .environment(appState)
        }
    }
}
