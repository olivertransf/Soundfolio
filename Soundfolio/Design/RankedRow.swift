import SwiftUI

struct RankedRow: View {
    let rank: Int
    let title: String
    let subtitle: String
    let value: String
    let artworkURL: String?
    var isCircleArt = false

    var body: some View {
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
    }
}
