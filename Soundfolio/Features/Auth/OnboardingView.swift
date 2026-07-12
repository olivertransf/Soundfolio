import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(StatsPreferences.self) private var preferences

    @State private var lastfmUsername = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Setup")
                        .font(SoundfolioFont.semibold(12))
                        .foregroundStyle(accent)
                        .textCase(.uppercase)
                        .kerning(1.5)
                    Text("Connect Last.fm")
                        .font(SoundfolioFont.bold(28))
                    Text("Use the username from your profile URL, like last.fm/user/yourname. After setup, your Dashboard shows listening stats. Import Spotify history on the web if needed.")
                        .font(SoundfolioTheme.rowSubtitleFont)
                        .foregroundStyle(SoundfolioTheme.mutedForeground)
                }
                .padding(.top, 32)

                TextField("Last.fm username", text: $lastfmUsername)
                    .font(SoundfolioFont.regular(14))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 12)
                    .frame(minHeight: SoundfolioTheme.controlMinHeight)
                    .background(SoundfolioTheme.panelBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: SoundfolioTheme.cornerRadius(from: preferences))
                            .strokeBorder(SoundfolioTheme.border, lineWidth: 1)
                    }

                if let errorMessage {
                    Text(errorMessage)
                        .font(SoundfolioTheme.captionFont)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await save() }
                } label: {
                    Text(isWorking ? "Saving..." : "Continue")
                        .font(SoundfolioFont.semibold(14))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: SoundfolioTheme.controlMinHeight)
                        .foregroundStyle(Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255))
                        .background(accent)
                }
                .buttonStyle(.plain)
                .disabled(isWorking || lastfmUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.bottom, 32)
        }
        .background(SoundfolioTheme.pageBackground.ignoresSafeArea())
    }

    private func save() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await auth.completeOnboarding(lastfmUsername: lastfmUsername)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
