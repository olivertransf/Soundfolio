import SwiftUI

struct ArtworkView: View {
    let urlString: String?
    var size: CGFloat = 44
    var cornerRadius: CGFloat = 8
    var isCircle = false

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .modifier(ArtworkClipModifier(isCircle: isCircle, cornerRadius: cornerRadius))
        .task(id: urlString) {
            await loadImage()
        }
    }

    private func loadImage() async {
        image = nil
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
            Color(.tertiarySystemFill)
            Image(systemName: isCircle ? "person.fill" : "music.note")
                .font(.system(size: size * 0.35))
                .foregroundStyle(.secondary)
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
