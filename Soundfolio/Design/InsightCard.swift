import SwiftUI

struct InsightCard: View {
    @Environment(StatsPreferences.self) private var preferences

    let label: String
    let primaryValue: String
    let detail: String
    var accent: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(SoundfolioFont.semibold(10))
                .tracking(0.5)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            Text(primaryValue)
                .font(SoundfolioTheme.insightValueFont)
                .foregroundStyle(accent)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(detail)
                .font(SoundfolioTheme.captionFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .soundfolioPanel(preferences: preferences)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(primaryValue). \(detail)")
    }
}
