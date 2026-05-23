import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Bindable var preferences: StatsPreferences
    @State private var savedMessage: String?

    var body: some View {
        Form {
            Section("Server") {
                TextField("Base URL", text: $preferences.baseURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Text("Default: \(StatsPreferences.defaultBaseURL)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Appearance") {
                Picker("Accent", selection: $preferences.accent) {
                    ForEach(AppAccent.allCases) { accent in
                        Text(accent.rawValue.capitalized).tag(accent)
                    }
                }
                Picker("Theme", selection: Binding(
                    get: { preferences.preferredColorScheme ?? .dark },
                    set: { preferences.preferredColorScheme = $0 }
                )) {
                    Text("Dark").tag(ColorScheme.dark)
                    Text("Light").tag(ColorScheme.light)
                }
            }

            Section {
                Button("Save") {
                    appState.reloadClient()
                    savedMessage = "Saved"
                }
            }

            if let savedMessage {
                Section {
                    Text(savedMessage)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
