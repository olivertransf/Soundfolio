import Foundation
import SwiftUI

@Observable
final class StatsPreferences {
    static let defaultBaseURL = "https://soundfolio-stats.vercel.app"

    private enum Keys {
        static let period = "soundfolioPeriod"
        static let customFrom = "soundfolioCustomFrom"
        static let customTo = "soundfolioCustomTo"
        static let sort = "soundfolioTopSort"
        static let chartGroup = "soundfolioChartGroupBy"
        static let chartMetric = "soundfolioChartMetric"
        static let accent = "soundfolioAccent"
        static let colorScheme = "soundfolioColorScheme"
    }

    var period: StatsPeriod {
        didSet { UserDefaults.standard.set(period.rawValue, forKey: Keys.period) }
    }

    var customFrom: String {
        didSet { UserDefaults.standard.set(customFrom, forKey: Keys.customFrom) }
    }

    var customTo: String {
        didSet { UserDefaults.standard.set(customTo, forKey: Keys.customTo) }
    }

    var sort: TopSortMode {
        didSet { UserDefaults.standard.set(sort.rawValue, forKey: Keys.sort) }
    }

    var chartGroupBy: ChartGroupBy {
        didSet { UserDefaults.standard.set(chartGroupBy.rawValue, forKey: Keys.chartGroup) }
    }

    var chartMetric: ChartMetric {
        didSet { UserDefaults.standard.set(chartMetric.rawValue, forKey: Keys.chartMetric) }
    }

    var accent: AppAccent {
        didSet { UserDefaults.standard.set(accent.rawValue, forKey: Keys.accent) }
    }

    var preferredColorScheme: ColorScheme? {
        didSet {
            if let preferredColorScheme {
                UserDefaults.standard.set(preferredColorScheme == .dark ? "dark" : "light", forKey: Keys.colorScheme)
            } else {
                UserDefaults.standard.removeObject(forKey: Keys.colorScheme)
            }
        }
    }

    var usesCustomRange: Bool {
        !customFrom.isEmpty && !customTo.isEmpty
    }

    init() {
        let defaults = UserDefaults.standard
        period = StatsPeriod(rawValue: defaults.string(forKey: Keys.period) ?? "") ?? .ytd
        customFrom = defaults.string(forKey: Keys.customFrom) ?? ""
        customTo = defaults.string(forKey: Keys.customTo) ?? ""
        sort = TopSortMode(rawValue: defaults.string(forKey: Keys.sort) ?? "") ?? .minutes
        chartGroupBy = ChartGroupBy(rawValue: defaults.string(forKey: Keys.chartGroup) ?? "") ?? .weeks
        chartMetric = ChartMetric(rawValue: defaults.string(forKey: Keys.chartMetric) ?? "") ?? .minutes
        accent = AppAccent(rawValue: defaults.string(forKey: Keys.accent) ?? "") ?? .spotify
        switch defaults.string(forKey: Keys.colorScheme) {
        case "dark": preferredColorScheme = .dark
        case "light": preferredColorScheme = .light
        default: preferredColorScheme = .dark
        }
    }

    var importURL: URL? {
        guard var components = serverOriginComponents else { return nil }
        components.path = "/history/import"
        return components.url
    }

    var serverOriginComponents: URLComponents? {
        guard var components = URLComponents(string: Self.defaultBaseURL), components.host?.isEmpty == false else {
            return nil
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components
    }
}
