import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var auth
    @Bindable var preferences: StatsPreferences
    @State private var lastfmUsername = ""
    @State private var isSavingUsername = false
    @State private var usernameMessage: String?
    @State private var syncError: String?

    var body: some View {
        Form {
            if let email = auth.user?.email {
                Section("Account") {
                    Text(email)
                        .foregroundStyle(.secondary)
                    TextField("Last.fm username", text: $lastfmUsername)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    if let usernameMessage {
                        Text(usernameMessage)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Button(isSavingUsername ? "Saving…" : "Save username") {
                        Task { await saveUsername() }
                    }
                    .disabled(isSavingUsername || lastfmUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button("Sign out", role: .destructive) {
                        try? auth.signOut()
                    }
                }
            }

            Section("Data") {
                SyncStatusPanel(
                    isSyncing: appState.isSyncing,
                    progressMessage: appState.syncProgressMessage,
                    savedCount: appState.syncSavedCount,
                    pendingCount: appState.syncPendingCount,
                    lastResult: appState.lastSyncResult,
                    lastSyncedAt: appState.lastSyncedAt,
                    accent: SoundfolioTheme.accent(from: preferences),
                    onSync: { Task { await syncNow() } }
                )
                if let url = preferences.importURL {
                    Link("Import Spotify history on web", destination: url)
                }
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
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            lastfmUsername = auth.lastfmUsername ?? ""
        }
        .alert("Sync failed", isPresented: Binding(
            get: { syncError != nil },
            set: { if !$0 { syncError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(syncError ?? "")
        }
    }

    private func saveUsername() async {
        isSavingUsername = true
        defer { isSavingUsername = false }
        do {
            try await auth.updateLastFmUsername(lastfmUsername)
            usernameMessage = "Username saved"
        } catch {
            usernameMessage = error.localizedDescription
        }
    }

    private func syncNow() async {
        do {
            _ = try await appState.syncLastFm()
        } catch {
            syncError = appState.handleError(error)
        }
    }
}
