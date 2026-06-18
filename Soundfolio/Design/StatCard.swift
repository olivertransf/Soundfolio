import SwiftUI

struct StatCard: View {
    let label: String
    let value: String
    var hint: String?
    let systemImage: String
    var style: Style = .compact
    var accent: Color = .accentColor

    enum Style {
        case hero
        case compact
    }

    var body: some View {
        VStack(alignment: .leading, spacing: style == .hero ? 8 : 4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label.uppercased())
                        .font(style == .hero ? .caption.weight(.semibold) : .caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(value)
                        .font(style == .hero ? SoundfolioTheme.heroStatFont : .subheadline.weight(.semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let hint {
                        Text(hint)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
                Image(systemName: systemImage)
                    .font(style == .hero ? .title3 : .caption)
                    .foregroundStyle(accent)
                    .frame(width: style == .hero ? 36 : 28, height: style == .hero ? 36 : 28)
                    .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, minHeight: style == .hero ? SoundfolioTheme.heroStatHeight : SoundfolioTheme.metricCellHeight, alignment: .topLeading)
        .padding(style == .hero ? SoundfolioTheme.cardPadding : 8)
        .background(
            SoundfolioTheme.cardBackground,
            in: RoundedRectangle(cornerRadius: SoundfolioTheme.cardCornerRadius, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: SoundfolioTheme.cardCornerRadius, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06))
        }
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 3)
    }
}
