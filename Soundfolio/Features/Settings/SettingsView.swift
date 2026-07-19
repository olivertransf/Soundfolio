import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(AuthManager.self) private var auth
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    @State private var lastfmUsername = ""
    @State private var isSavingUsername = false
    @State private var usernameMessage: String?
    @State private var syncError: String?

    @State private var fixingDurations = false
    @State private var fixingArtistArt = false
    @State private var fixingAlbumArt = false
    @State private var durationMessage: String?
    @State private var artistArtMessage: String?
    @State private var albumArtMessage: String?
    @State private var durationError = false
    @State private var artistArtError = false
    @State private var albumArtError = false

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var backfillBusy: Bool { fixingDurations || fixingArtistArt || fixingAlbumArt }

    private var lastFmCount: Int {
        streamStore.streams.filter { $0.trackId.hasPrefix("lfm-") }.count
    }

    private var missingArtistArtCount: Int {
        Set(
            streamStore.streams
                .filter { !ArtURL.isUsable($0.artistArt) }
                .map { EntityNormalize.key($0.artistName) }
                .filter { !$0.isEmpty }
        ).count
    }

    private var missingAlbumArtCount: Int {
        Set(
            streamStore.streams
                .filter { !ArtURL.isUsable($0.albumArt) }
                .map { albumArtKey(for: $0) }
                .filter { !$0.isEmpty }
        ).count
    }

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

                    if let url = preferences.websiteURL {
                        Link("Open Soundfolio website", destination: url)
                            .font(SoundfolioFont.medium(13))
                    }
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

                    backfillButton(
                        title: fixingDurations ? "Fixing lengths…" : "Fix song lengths",
                        detail: lastFmCount == 0
                            ? "No Last.fm plays loaded."
                            : "Replace flat 3-minute Last.fm defaults with real catalog lengths. \(lastFmCount.formatted()) Last.fm plays loaded.",
                        message: durationMessage,
                        isError: durationError,
                        disabled: backfillBusy || appState.isSyncing || lastFmCount == 0
                    ) {
                        Task { await runFixSongLengths() }
                    }

                    backfillButton(
                        title: fixingArtistArt ? "Fixing artwork…" : "Fix artist artwork",
                        detail: missingArtistArtCount == 0
                            ? "Every loaded artist already has artwork."
                            : "Fill missing artist images via Last.fm, Discogs, and Deezer. \(missingArtistArtCount.formatted()) artists still missing art.",
                        message: artistArtMessage,
                        isError: artistArtError,
                        disabled: backfillBusy || appState.isSyncing || missingArtistArtCount == 0
                    ) {
                        Task { await runFixArtistArtwork() }
                    }

                    backfillButton(
                        title: fixingAlbumArt ? "Fixing artwork…" : "Fix album artwork",
                        detail: missingAlbumArtCount == 0
                            ? "Every loaded play already has album art."
                            : "Fill missing covers via Last.fm, iTunes, and Cover Art Archive. \(missingAlbumArtCount.formatted()) albums still missing art.",
                        message: albumArtMessage,
                        isError: albumArtError,
                        disabled: backfillBusy || appState.isSyncing || missingAlbumArtCount == 0
                    ) {
                        Task { await runFixAlbumArtwork() }
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

    private func backfillButton(
        title: String,
        detail: String,
        message: String?,
        isError: Bool,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: action) {
                Text(title)
                    .font(SoundfolioFont.semibold(13))
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: SoundfolioTheme.controlMinHeight)
                    .foregroundStyle(Color.primary)
                    .background(SoundfolioTheme.pageBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: SoundfolioTheme.cornerRadius(from: preferences))
                            .strokeBorder(SoundfolioTheme.border, lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .disabled(disabled)
            .opacity(disabled ? 0.5 : 1)

            Text(detail)
                .font(SoundfolioTheme.captionFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)

            if let message {
                Text(message)
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(isError ? Color.red : SoundfolioTheme.mutedForeground)
            }
        }
    }

    private func albumArtKey(for stream: StreamRecord) -> String {
        if !stream.albumName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return EntityNormalize.albumGroupKey(albumName: stream.albumName, artistName: stream.artistName)
        }
        return "track:\(EntityNormalize.key(stream.trackName))\0\(EntityNormalize.key(stream.artistName))"
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
            if AppState.isCancellation(error) { return }
            syncError = appState.handleError(error)
        }
    }

    private func runFixSongLengths() async {
        guard let uid = auth.user?.uid else { return }
        fixingDurations = true
        durationError = false
        durationMessage = "Starting…"
        defer { fixingDurations = false }
        do {
            appState.reloadClient()
            let result = try await MetadataBackfill.fixSongLengths(
                uid: uid,
                client: appState.client,
                streamStore: streamStore
            ) { progress in
                durationMessage = progress.message
            }
            durationMessage = result.message
        } catch {
            durationError = true
            durationMessage = appState.handleError(error)
        }
    }

    private func runFixArtistArtwork() async {
        guard let uid = auth.user?.uid else { return }
        fixingArtistArt = true
        artistArtError = false
        artistArtMessage = "Starting…"
        defer { fixingArtistArt = false }
        do {
            appState.reloadClient()
            let result = try await MetadataBackfill.fixArtistArtwork(
                uid: uid,
                client: appState.client,
                streamStore: streamStore
            ) { progress in
                artistArtMessage = progress.message
            }
            artistArtMessage = result.message
        } catch {
            artistArtError = true
            artistArtMessage = appState.handleError(error)
        }
    }

    private func runFixAlbumArtwork() async {
        guard let uid = auth.user?.uid else { return }
        fixingAlbumArt = true
        albumArtError = false
        albumArtMessage = "Starting…"
        defer { fixingAlbumArt = false }
        do {
            appState.reloadClient()
            let result = try await MetadataBackfill.fixAlbumArtwork(
                uid: uid,
                client: appState.client,
                streamStore: streamStore
            ) { progress in
                albumArtMessage = progress.message
            }
            albumArtMessage = result.message
        } catch {
            albumArtError = true
            albumArtMessage = appState.handleError(error)
        }
    }
}
