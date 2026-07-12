import SwiftUI

struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(SoundfolioTheme.labelFont)
                    .tracking(0.8)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                if let subtitle {
                    Text(subtitle)
                        .font(SoundfolioTheme.captionFont)
                        .foregroundStyle(SoundfolioTheme.mutedForeground)
                }
            }
            Spacer(minLength: 8)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(SoundfolioFont.semibold(12))
            }
        }
    }
}

struct RankColumn<Content: View>: View {
    @Environment(StatsPreferences.self) private var preferences
    let title: String
    let content: () -> Content

    init(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(SoundfolioTheme.labelFont)
                .tracking(0.8)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
                .padding(.horizontal, 10)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(SoundfolioTheme.border)
                        .frame(height: 1)
                }

            content()
                .padding(6)
        }
        .soundfolioPanel(preferences: preferences, padding: 0)
    }
}

struct PatternRankRow: View {
    @Environment(StatsPreferences.self) private var preferences
    let label: String
    let value: String
    let fraction: Double
    var accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(SoundfolioTheme.rowTitleFont)
                    .lineLimit(1)
                Spacer()
                Text(value)
                    .font(SoundfolioTheme.metricFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(SoundfolioTheme.mutedFill)
                    Capsule()
                        .fill(accent)
                        .frame(width: max(4, geo.size.width * min(max(fraction, 0), 1)))
                }
            }
            .frame(height: 4)
        }
        .padding(.vertical, SoundfolioTheme.rowVerticalPadding(from: preferences))
    }
}
