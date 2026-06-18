import SwiftUI

enum SoundfolioTheme {
    static let cardBackground = Color(.secondarySystemGroupedBackground)
    static let cardCornerRadius: CGFloat = 16
    static let pagePadding: CGFloat = 16
    static let cardPadding: CGFloat = 14
    static let sectionSpacing: CGFloat = 12
    static let chartHeight: CGFloat = 200
    static let chartHeightRegular: CGFloat = 280
    static let metricCellHeight: CGFloat = 78
    static let heroStatHeight: CGFloat = 92
    static let contentMaxWidth: CGFloat = 1180

    static let sectionTitleFont: Font = .subheadline.weight(.semibold)
    static let heroStatFont: Font = .title2.weight(.semibold)
    static let insightValueFont: Font = .title3.weight(.semibold)

    static func accent(from preferences: StatsPreferences) -> Color {
        preferences.accent.color.swiftUIColor
    }

    static func pagePadding(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
        horizontalSizeClass == .regular ? 24 : pagePadding
    }

    static func sectionSpacing(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
        horizontalSizeClass == .regular ? 16 : sectionSpacing
    }

    static func metricColumns(for horizontalSizeClass: UserInterfaceSizeClass?) -> [GridItem] {
        let count = horizontalSizeClass == .regular ? 4 : 2
        return Array(repeating: GridItem(.flexible(), spacing: 10), count: count)
    }

    static func heroColumns(for horizontalSizeClass: UserInterfaceSizeClass?) -> [GridItem] {
        if horizontalSizeClass == .regular {
            return Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)
        }
        return [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]
    }
}

struct CardModifier: ViewModifier {
    var minHeight: CGFloat?

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .padding(SoundfolioTheme.cardPadding)
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

extension View {
    func soundfolioCard(minHeight: CGFloat? = nil) -> some View {
        modifier(CardModifier(minHeight: minHeight))
    }

    func soundfolioPage() -> some View {
        modifier(AdaptivePageModifier())
    }
}

private struct AdaptivePageModifier: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: SoundfolioTheme.contentMaxWidth)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, SoundfolioTheme.pagePadding(for: horizontalSizeClass))
            .padding(.vertical, horizontalSizeClass == .regular ? 12 : 8)
    }
}

enum RankValueFormatter {
    static func primary(minutes: Int, streams: Int, sort: TopSortMode) -> String {
        sort == .streams
            ? "\(streams.formatted()) plays"
            : "\(minutes.formatted()) min"
    }

    static func secondary(minutes: Int, streams: Int, sort: TopSortMode) -> String {
        sort == .streams
            ? "\(minutes.formatted()) min"
            : "\(streams.formatted()) plays"
    }
}

func formatSpanLabel(_ span: OverviewSpan) -> String? {
    guard let first = parseISO8601(span.first), let last = parseISO8601(span.last) else { return nil }
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return "\(formatter.string(from: first)) – \(formatter.string(from: last))"
}

func formatHourLabel(_ label: String) -> String {
    let parts = label.split(separator: ":")
    guard let hour = Int(parts.first ?? "") else { return label }
    let formatter = DateFormatter()
    formatter.dateFormat = "h a"
    var components = DateComponents()
    components.hour = hour
    let calendar = Calendar.current
    let date = calendar.date(from: components) ?? Date()
    return formatter.string(from: date)
}
