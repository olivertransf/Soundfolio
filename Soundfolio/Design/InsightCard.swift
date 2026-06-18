import SwiftUI

struct InsightCard: View {
    let label: String
    let primaryValue: String
    let detail: String
    var accent: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .tracking(0.5)
            Text(primaryValue)
                .font(SoundfolioTheme.insightValueFont)
                .foregroundStyle(accent)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .soundfolioCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(primaryValue). \(detail)")
    }
}
