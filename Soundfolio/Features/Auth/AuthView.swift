import SwiftUI

struct AuthView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(StatsPreferences.self) private var preferences

    @State private var isWorking = false
    @State private var errorMessage: String?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("Soundfolio")
                        .font(SoundfolioFont.semibold(12))
                        .foregroundStyle(accent)
                        .textCase(.uppercase)
                        .kerning(1.5)
                    Text("Sign in")
                        .font(SoundfolioFont.bold(28))
                    Text("Sign in with Google to sync your listening stats across devices.")
                        .font(SoundfolioTheme.rowSubtitleFont)
                        .foregroundStyle(SoundfolioTheme.mutedForeground)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 32)

                if let errorMessage {
                    Text(errorMessage)
                        .font(SoundfolioTheme.captionFont)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await signInWithGoogle() }
                } label: {
                    Text(isWorking ? "Signing in..." : "Continue with Google")
                        .font(SoundfolioFont.semibold(14))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: SoundfolioTheme.controlMinHeight)
                        .foregroundStyle(Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255))
                        .background(accent)
                }
                .buttonStyle(.plain)
                .disabled(isWorking)
            }
            .padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.bottom, 32)
        }
        .background(SoundfolioTheme.pageBackground.ignoresSafeArea())
    }

    private func signInWithGoogle() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await auth.signInWithGoogle()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
