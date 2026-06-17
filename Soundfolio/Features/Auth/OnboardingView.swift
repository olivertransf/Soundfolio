import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.colorScheme) private var colorScheme

    @State private var lastfmUsername = ""
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Setup")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.green)
                        .textCase(.uppercase)
                        .kerning(1.5)
                    Text("Connect Last.fm")
                        .font(.title.bold())
                    Text("Use the username from your profile URL, like last.fm/user/yourname.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                TextField("Last.fm username", text: $lastfmUsername)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(14)
                    .background(RoundedRectangle(cornerRadius: 12).fill(.quaternary.opacity(colorScheme == .dark ? 0.35 : 0.8)))

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await save() }
                } label: {
                    Text(isWorking ? "Saving..." : "Continue")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isWorking || lastfmUsername.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.bottom, 32)
        }
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
