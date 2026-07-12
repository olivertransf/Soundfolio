import SwiftUI

enum SoundfolioFont {
    static func regular(_ size: CGFloat) -> Font {
        .custom("JetBrainsMono-Regular", size: size)
    }

    static func medium(_ size: CGFloat) -> Font {
        .custom("JetBrainsMono-Medium", size: size)
    }

    static func semibold(_ size: CGFloat) -> Font {
        .custom("JetBrainsMono-SemiBold", size: size)
    }

    static func bold(_ size: CGFloat) -> Font {
        .custom("JetBrainsMono-Bold", size: size)
    }
}

enum DisplayDensity: String, CaseIterable, Identifiable {
    case cozy
    case compact

    var id: String { rawValue }

    var label: String {
        switch self {
        case .cozy: "Cozy"
        case .compact: "Compact"
        }
    }
}

enum DisplayRadius: String, CaseIterable, Identifiable {
    case sharp
    case soft
    case round

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sharp: "Sharp"
        case .soft: "Soft"
        case .round: "Round"
        }
    }

    var value: CGFloat {
        switch self {
        case .sharp: 0
        case .soft: 6
        case .round: 12
        }
    }
}

enum ArtworkPref: String, CaseIterable, Identifiable {
    case show
    case hide

    var id: String { rawValue }

    var label: String {
        switch self {
        case .show: "Show"
        case .hide: "Hide"
        }
    }
}

enum TimeDisplayPref: String, CaseIterable, Identifiable {
    case absolute
    case relative

    var id: String { rawValue }

    var label: String {
        switch self {
        case .absolute: "Clock"
        case .relative: "Relative"
        }
    }
}

enum SoundfolioTheme {
    static let pageBackground = Color(red: 9 / 255, green: 9 / 255, blue: 11 / 255)
    static let panelBackground = Color(red: 18 / 255, green: 18 / 255, blue: 20 / 255)
    static let mutedFill = Color(red: 28 / 255, green: 28 / 255, blue: 31 / 255)
    static let border = Color(red: 39 / 255, green: 39 / 255, blue: 42 / 255)
    static let mutedForeground = Color(red: 161 / 255, green: 161 / 255, blue: 170 / 255)

    static let pagePadding: CGFloat = 16
    static let panelPadding: CGFloat = 12
    static let sectionSpacing: CGFloat = 12
    static let contentMaxWidth: CGFloat = 1180
    static let controlMinHeight: CGFloat = 44
    static let metricCellHeight: CGFloat = 64
    static let recentColumnWidth: CGFloat = 340

    static let sectionTitleFont = SoundfolioFont.semibold(14)
    static let pageTitleFont = SoundfolioFont.semibold(18)
    static let heroStatFont = SoundfolioFont.semibold(18)
    static let insightValueFont = SoundfolioFont.semibold(16)
    static let rowTitleFont = SoundfolioFont.medium(14)
    static let rowSubtitleFont = SoundfolioFont.regular(12)
    static let metricFont = SoundfolioFont.medium(12)
    static let captionFont = SoundfolioFont.regular(11)
    static let labelFont = SoundfolioFont.semibold(11)

    static func accent(from preferences: StatsPreferences) -> Color {
        preferences.accent.color.swiftUIColor
    }

    static func cornerRadius(from preferences: StatsPreferences) -> CGFloat {
        preferences.radius.value
    }

    static func rowVerticalPadding(from preferences: StatsPreferences) -> CGFloat {
        preferences.density == .compact ? 4 : 8
    }

    static func artworkSize(from preferences: StatsPreferences, list: Bool = true) -> CGFloat {
        if preferences.artwork == .hide { return 0 }
        return list ? (preferences.density == .compact ? 28 : 32) : 40
    }

    static func pagePadding(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
        horizontalSizeClass == .regular ? 24 : pagePadding
    }

    static func sectionSpacing(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
        horizontalSizeClass == .regular ? 16 : sectionSpacing
    }

    static func metricColumns(for horizontalSizeClass: UserInterfaceSizeClass?) -> [GridItem] {
        let count = horizontalSizeClass == .regular ? 6 : 3
        return Array(repeating: GridItem(.flexible(), spacing: 8), count: count)
    }
}

struct PanelModifier: ViewModifier {
    var preferences: StatsPreferences
    var padding: CGFloat = SoundfolioTheme.panelPadding
    var minHeight: CGFloat?

    func body(content: Content) -> some View {
        let radius = SoundfolioTheme.cornerRadius(from: preferences)
        content
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .padding(padding)
            .background(
                SoundfolioTheme.panelBackground,
                in: RoundedRectangle(cornerRadius: radius, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(SoundfolioTheme.border, lineWidth: 1)
            }
    }
}

extension View {
    func soundfolioPanel(
        preferences: StatsPreferences,
        padding: CGFloat = SoundfolioTheme.panelPadding,
        minHeight: CGFloat? = nil
    ) -> some View {
        modifier(PanelModifier(preferences: preferences, padding: padding, minHeight: minHeight))
    }

    /// Back-compat alias used across older call sites.
    func soundfolioCard(minHeight: CGFloat? = nil) -> some View {
        modifier(LegacyPanelModifier(minHeight: minHeight))
    }

    func soundfolioPage() -> some View {
        modifier(AdaptivePageModifier())
    }
}

private struct LegacyPanelModifier: ViewModifier {
    var minHeight: CGFloat?
    @Environment(StatsPreferences.self) private var preferences

    func body(content: Content) -> some View {
        content.soundfolioPanel(preferences: preferences, minHeight: minHeight)
    }
}

private struct AdaptivePageModifier: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(StatsPreferences.self) private var preferences

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: SoundfolioTheme.contentMaxWidth)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, SoundfolioTheme.pagePadding(for: horizontalSizeClass))
            .padding(.vertical, preferences.density == .compact ? 4 : (horizontalSizeClass == .regular ? 12 : 8))
    }
}

enum RankValueFormatter {
    static func primary(minutes: Int, streams: Int, sort: TopSortMode) -> String {
        sort == .streams
            ? "\(streams.formatted())"
            : "\(minutes.formatted())m"
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

func formatPlayTime(_ date: Date, preference: TimeDisplayPref) -> String {
    switch preference {
    case .relative:
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    case .absolute:
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
