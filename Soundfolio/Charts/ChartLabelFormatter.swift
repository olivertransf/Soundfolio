import Foundation

enum ChartAxisLabelStyle: Equatable {
    case listeningHistory(ChartGroupBy)
    case hourOfDay
    case weekday
    case automatic

    var anchorsToPresent: Bool {
        if case .listeningHistory = self { return true }
        return false
    }
}

/// Axis labels aligned with the website (`formatChartAxisLabel` in stats-timezone).
enum ChartLabelFormatter {
    static func format(_ raw: String, style: ChartAxisLabelStyle) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        switch style {
        case .hourOfDay:
            return formatHourAxis(trimmed)
        case .weekday:
            return trimmed
        case .listeningHistory(let groupBy):
            return formatHistoryAxis(trimmed, groupBy: groupBy)
        case .automatic:
            if trimmed.contains(":") { return formatHourAxis(trimmed) }
            if isYearMonth(trimmed) { return formatYearMonthAxis(trimmed) }
            if isISODate(trimmed) { return formatDayAxis(trimmed) }
            return trimmed
        }
    }

    static func accessibilityLabel(_ raw: String, style: ChartAxisLabelStyle) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        switch style {
        case .hourOfDay:
            return "Hour starting \(trimmed)"
        case .weekday:
            return weekdayFullName(trimmed) ?? trimmed
        case .listeningHistory(let groupBy):
            return formatHistoryAccessibility(trimmed, groupBy: groupBy)
        case .automatic:
            return trimmed
        }
    }

    // MARK: - History (matches web: short month + day, or month + 2-digit year)

    private static func formatHistoryAxis(_ raw: String, groupBy: ChartGroupBy) -> String {
        switch groupBy {
        case .months:
            return formatYearMonthAxis(raw)
        case .weeks, .days:
            return formatDayAxis(raw)
        }
    }

    private static func formatHistoryAccessibility(_ raw: String, groupBy: ChartGroupBy) -> String {
        switch groupBy {
        case .months:
            if isYearMonth(raw), let date = parseYearMonth(raw) {
                return monthYearLongFormatter.string(from: date)
            }
            return raw
        case .weeks:
            if let date = parseISODate(raw) {
                return "Week of \(dayLongFormatter.string(from: date))"
            }
            return raw
        case .days:
            if let date = parseISODate(raw) {
                return dayLongFormatter.string(from: date)
            }
            return raw
        }
    }

    private static func formatDayAxis(_ raw: String) -> String {
        guard let date = parseISODate(raw) else { return raw }
        return axisMonthDayFormatter.string(from: date)
    }

    private static func formatYearMonthAxis(_ raw: String) -> String {
        guard let date = parseYearMonth(raw) else { return raw }
        return axisMonthYearFormatter.string(from: date)
    }

    // MARK: - Hour (matches web: `14:00` → `14h`)

    private static func formatHourAxis(_ raw: String) -> String {
        if raw.contains(":") {
            return raw.replacingOccurrences(of: ":00", with: "h")
        }
        return raw
    }

    // MARK: - Parsing

    private static func isISODate(_ raw: String) -> Bool {
        parseISODate(raw) != nil
    }

    private static func isYearMonth(_ raw: String) -> Bool {
        raw.firstMatch(of: /^\d{4}-\d{2}$/) != nil
    }

    private static func parseISODate(_ raw: String) -> Date? {
        isoDayFormatter.date(from: raw) ?? isoDayFormatterNoPad.date(from: raw)
    }

    private static func parseYearMonth(_ raw: String) -> Date? {
        guard isYearMonth(raw) else { return nil }
        let parts = raw.split(separator: "-")
        guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]) else { return nil }
        return calendar.date(from: DateComponents(year: year, month: month, day: 1))
    }

    private static func weekdayFullName(_ short: String) -> String? {
        let map = ["Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
                   "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday"]
        return map[short]
    }

    private static let calendar = Calendar.current

    private static let isoDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static let isoDayFormatterNoPad: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-M-d"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static let axisMonthDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.setLocalizedDateFormatFromTemplate("MMMd")
        return f
    }()

    private static let axisMonthYearFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.setLocalizedDateFormatFromTemplate("MMMyy")
        return f
    }()

    private static let monthYearLongFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.setLocalizedDateFormatFromTemplate("MMMM yyyy")
        return f
    }()

    private static let dayLongFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "EEEE, MMM d, yyyy"
        return f
    }()
}
