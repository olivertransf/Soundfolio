import SwiftUI

struct ArtworkView: View {
    let urlString: String?
    var size: CGFloat = 44
    var cornerRadius: CGFloat = 8
    var isCircle = false

    var body: some View {
        artworkContent
            .frame(width: size, height: size)
            .modifier(ArtworkClipModifier(isCircle: isCircle, cornerRadius: cornerRadius))
    }

    @ViewBuilder
    private var artworkContent: some View {
        if let urlString, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
        } else {
            placeholder
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
