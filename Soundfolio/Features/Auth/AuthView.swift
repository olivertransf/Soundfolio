import SwiftUI

struct AuthView: View {
    @Environment(AuthManager.self) private var auth

    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("Soundfolio")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.green)
                        .textCase(.uppercase)
                        .kerning(1.5)
                    Text("Sign in")
                        .font(.title.bold())
                    Text("Sign in with Google to sync your listening stats across devices.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 32)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await signInWithGoogle() }
                } label: {
                    Text(isWorking ? "Signing in..." : "Continue with Google")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking)
            }
            .padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.bottom, 32)
        }
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
