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

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                settingsSection(title: "Account") {
                    if let email = auth.user?.email {
                        Text(email)
                            .font(SoundfolioTheme.rowSubtitleFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("LAST.FM USERNAME")
                            .font(SoundfolioTheme.labelFont)
                            .tracking(0.6)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                        TextField("yourname", text: $lastfmUsername)
                            .font(SoundfolioFont.regular(14))
                            .padding(.horizontal, 12)
                            .frame(minHeight: SoundfolioTheme.controlMinHeight)
                            .background(SoundfolioTheme.pageBackground)
                            .overlay {
                                RoundedRectangle(cornerRadius: SoundfolioTheme.cornerRadius(from: preferences))
                                    .strokeBorder(SoundfolioTheme.border, lineWidth: 1)
                            }
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    if let usernameMessage {
                        Text(usernameMessage)
                            .font(SoundfolioTheme.captionFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                    }

                    Button {
                        Task { await saveUsername() }
                    } label: {
                        Text(isSavingUsername ? "Saving…" : "Save username")
                            .font(SoundfolioFont.semibold(13))
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: SoundfolioTheme.controlMinHeight)
                            .foregroundStyle(Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255))
                            .background(accent)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSavingUsername || lastfmUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button("Sign out", role: .destructive) {
                        try? auth.signOut()
                    }
                    .font(SoundfolioFont.medium(13))
                }

                settingsSection(title: "Data") {
                    SyncStatusPanel(
                        isSyncing: appState.isSyncing,
                        progressMessage: appState.syncProgressMessage,
                        savedCount: appState.syncSavedCount,
                        pendingCount: appState.syncPendingCount,
                        lastResult: appState.lastSyncResult,
                        lastSyncedAt: appState.lastSyncedAt,
                        accent: accent,
                        onSync: { Task { await syncNow() } }
                    )
                    if let url = preferences.importURL {
                        Link("Import Spotify history on web", destination: url)
                            .font(SoundfolioFont.medium(13))
                    }
                }

                settingsSection(title: "Appearance") {
                    prefPicker(
                        title: "Accent",
                        options: AppAccent.allCases.map { ($0, $0.label) },
                        selection: $preferences.accent
                    )

                    prefPicker(
                        title: "Theme",
                        options: [
                            (Optional.some(ColorScheme.dark), "Dark"),
                            (Optional.some(ColorScheme.light), "Light"),
                            (Optional.none, "System"),
                        ],
                        selection: Binding(
                            get: { preferences.preferredColorScheme },
                            set: { preferences.preferredColorScheme = $0 }
                        )
                    )

                    prefPicker(
                        title: "Density",
                        options: DisplayDensity.allCases.map { ($0, $0.label) },
                        selection: $preferences.density
                    )

                    prefPicker(
                        title: "Radius",
                        options: DisplayRadius.allCases.map { ($0, $0.label) },
                        selection: $preferences.radius
                    )

                    prefPicker(
                        title: "Artwork",
                        options: ArtworkPref.allCases.map { ($0, $0.label) },
                        selection: $preferences.artwork
                    )

                    prefPicker(
                        title: "Time",
                        options: TimeDisplayPref.allCases.map { ($0, $0.label) },
                        selection: $preferences.timeDisplay
                    )
                }
            }
            .soundfolioPage()
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

    private func settingsSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(SoundfolioTheme.labelFont)
                .tracking(0.8)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            content()
        }
        .soundfolioPanel(preferences: preferences)
    }

    private func prefPicker<Option: Hashable>(
        title: String,
        options: [(Option, String)],
        selection: Binding<Option>
    ) -> some View {
        SoundfolioSegmentedControl(title: title, options: options, selection: selection)
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
