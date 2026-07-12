import SwiftUI

struct ArtworkView: View {
    @Environment(StatsPreferences.self) private var preferences

    let urlString: String?
    var size: CGFloat = 32
    var cornerRadius: CGFloat = 4
    var isCircle = false
    var letterFallback: String?

    @State private var image: UIImage?

    var body: some View {
        Group {
            if preferences.artwork == .hide {
                EmptyView()
            } else if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .frame(width: preferences.artwork == .hide ? 0 : size, height: preferences.artwork == .hide ? 0 : size)
        .modifier(ArtworkClipModifier(isCircle: isCircle, cornerRadius: cornerRadius))
        .overlay {
            if isCircle && preferences.artwork != .hide {
                Circle().strokeBorder(SoundfolioTheme.border, lineWidth: 1)
            }
        }
        .task(id: urlString) {
            await loadImage()
        }
    }

    private func loadImage() async {
        image = nil
        guard preferences.artwork != .hide else { return }
        guard let urlString, let url = URL(string: urlString) else { return }
        if let cached = ArtworkCache.image(for: url) {
            image = cached
            return
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let loaded = UIImage(data: data) else { return }
            ArtworkCache.store(loaded, for: url)
            image = loaded
        } catch {
            image = nil
        }
    }

    private var placeholder: some View {
        ZStack {
            SoundfolioTheme.mutedFill
            if let letterFallback, !letterFallback.isEmpty {
                Text(letterFallback)
                    .font(SoundfolioFont.semibold(size * 0.4))
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            } else {
                Image(systemName: isCircle ? "person.fill" : "music.note")
                    .font(.system(size: size * 0.35))
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            }
        }
    }
}

private struct ArtworkClipModifier: ViewModifier {
    let isCircle: Bool
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        if isCircle {
            content.clipShape(Circle())
        } else {
            content.clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        }
    }
}
