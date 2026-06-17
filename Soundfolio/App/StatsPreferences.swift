import Foundation
import SwiftUI

@Observable
final class StatsPreferences {
    static let defaultBaseURL = "https://soundfolio-stats.vercel.app"

    private enum Keys {
        static let baseURL = "soundfolioBaseURL"
        static let period = "soundfolioPeriod"
        static let customFrom = "soundfolioCustomFrom"
        static let customTo = "soundfolioCustomTo"
        static let sort = "soundfolioTopSort"
        static let chartGroup = "soundfolioChartGroupBy"
        static let accent = "soundfolioAccent"
        static let colorScheme = "soundfolioColorScheme"
    }

    var baseURL: String {
        didSet { UserDefaults.standard.set(baseURL, forKey: Keys.baseURL) }
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

    private static let legacyBaseURL = "https://mongodb-vercel-redesign.vercel.app"

    init() {
        let defaults = UserDefaults.standard
        let storedURL = defaults.string(forKey: Keys.baseURL) ?? ""
        if storedURL.isEmpty || storedURL == Self.legacyBaseURL {
            baseURL = Self.defaultBaseURL
        } else {
            baseURL = storedURL
        }
        period = StatsPeriod(rawValue: defaults.string(forKey: Keys.period) ?? "") ?? .ytd
        customFrom = defaults.string(forKey: Keys.customFrom) ?? ""
        customTo = defaults.string(forKey: Keys.customTo) ?? ""
        sort = TopSortMode(rawValue: defaults.string(forKey: Keys.sort) ?? "") ?? .minutes
        chartGroupBy = ChartGroupBy(rawValue: defaults.string(forKey: Keys.chartGroup) ?? "") ?? .weeks
        accent = AppAccent(rawValue: defaults.string(forKey: Keys.accent) ?? "") ?? .spotify
        switch defaults.string(forKey: Keys.colorScheme) {
        case "dark": preferredColorScheme = .dark
        case "light": preferredColorScheme = .light
        default: preferredColorScheme = .dark
        }
    }

    var importURL: URL? {
        var base = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !base.isEmpty else { return nil }
        if !base.hasPrefix("http") { base = "https://\(base)" }
        while base.hasSuffix("/") { base.removeLast() }
        return URL(string: "\(base)/history/import")
    }
}
