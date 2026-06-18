import SwiftUI

struct RankedRow: View {
    let rank: Int
    let title: String
    let subtitle: String
    let value: String
    let artworkURL: String?
    var isCircleArt = false
    var destination: AnyView?

    init(
        rank: Int,
        title: String,
        subtitle: String,
        value: String,
        artworkURL: String?,
        isCircleArt: Bool = false,
        destination: (some View)? = nil
    ) {
        self.rank = rank
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.artworkURL = artworkURL
        self.isCircleArt = isCircleArt
        self.destination = destination.map { AnyView($0) }
    }

    var body: some View {
        Group {
            if let destination {
                NavigationLink(destination: destination) {
                    rowContent
                }
                .buttonStyle(.plain)
            } else {
                rowContent
            }
        }
    }

    private var rowContent: some View {
        HStack(spacing: 12) {
            Text("\(rank)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 22, alignment: .center)
                .monospacedDigit()

            ArtworkView(urlString: artworkURL, size: 44, isCircle: isCircleArt)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            Text(value)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
