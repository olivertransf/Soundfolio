import SwiftUI

struct StatCard: View {
    @Environment(StatsPreferences.self) private var preferences

    let label: String
    let value: String
    var hint: String?
    var accent: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(SoundfolioFont.semibold(10))
                .tracking(0.6)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            Text(value)
                .font(SoundfolioTheme.heroStatFont)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let hint {
                Text(hint)
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: SoundfolioTheme.metricCellHeight, alignment: .topLeading)
        .soundfolioPanel(preferences: preferences, padding: 10)
    }
}
