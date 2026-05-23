import SwiftUI

enum SoundfolioTheme {
    static let cardBackground = Color(.secondarySystemGroupedBackground)
    static let pagePadding: CGFloat = 16
    static let cardPadding: CGFloat = 12
    static let sectionSpacing: CGFloat = 12
    static let chartHeight: CGFloat = 168
    static let metricCellHeight: CGFloat = 72

    static func accent(from preferences: StatsPreferences) -> Color {
        preferences.accent.color.swiftUIColor
    }
}

struct CardModifier: ViewModifier {
    var minHeight: CGFloat?

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .padding(SoundfolioTheme.cardPadding)
            .background(SoundfolioTheme.cardBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

extension View {
    func soundfolioCard(minHeight: CGFloat? = nil) -> some View {
        modifier(CardModifier(minHeight: minHeight))
    }

    func soundfolioPage() -> some View {
        padding(.horizontal, SoundfolioTheme.pagePadding)
            .padding(.vertical, 8)
    }
}
