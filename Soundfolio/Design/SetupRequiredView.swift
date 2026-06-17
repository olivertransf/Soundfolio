import SwiftUI

struct SetupRequiredView: View {
    @Bindable var preferences: StatsPreferences

    var body: some View {
        ContentUnavailableView {
            Label("Connect your server", systemImage: "link")
        } description: {
            Text("Enter your deployed Soundfolio URL in Settings to load listening stats.")
        } actions: {
            NavigationLink {
                SettingsView(preferences: preferences)
            } label: {
                Text("Open Settings")
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
