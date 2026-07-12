import SwiftUI

struct RankedRow: View {
    @Environment(StatsPreferences.self) private var preferences

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
        let artSize = SoundfolioTheme.artworkSize(from: preferences)
        return HStack(spacing: 10) {
            Text("\(rank)")
                .font(SoundfolioTheme.metricFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
                .frame(width: 20, alignment: .trailing)

            if artSize > 0 {
                ArtworkView(
                    urlString: artworkURL,
                    size: artSize,
                    cornerRadius: max(2, SoundfolioTheme.cornerRadius(from: preferences) - 2),
                    isCircle: isCircleArt,
                    letterFallback: isCircleArt ? String(title.prefix(1)).uppercased() : nil
                )
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(SoundfolioTheme.rowTitleFont)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(SoundfolioTheme.rowSubtitleFont)
                        .foregroundStyle(SoundfolioTheme.mutedForeground)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            Text(value)
                .font(SoundfolioTheme.metricFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, SoundfolioTheme.rowVerticalPadding(from: preferences))
        .contentShape(Rectangle())
    }
}
