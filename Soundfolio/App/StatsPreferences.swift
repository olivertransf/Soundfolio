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
        static let accent = "soundfolioAccent"
        static let colorScheme = "soundfolioColorScheme"
        static let density = "soundfolioDensity"
        static let radius = "soundfolioRadius"
        static let artwork = "soundfolioArtwork"
        static let timeDisplay = "soundfolioTimeDisplay"
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

    var density: DisplayDensity {
        didSet { UserDefaults.standard.set(density.rawValue, forKey: Keys.density) }
    }

    var radius: DisplayRadius {
        didSet { UserDefaults.standard.set(radius.rawValue, forKey: Keys.radius) }
    }

    var artwork: ArtworkPref {
        didSet { UserDefaults.standard.set(artwork.rawValue, forKey: Keys.artwork) }
    }

    var timeDisplay: TimeDisplayPref {
        didSet { UserDefaults.standard.set(timeDisplay.rawValue, forKey: Keys.timeDisplay) }
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
        accent = AppAccent(rawValue: defaults.string(forKey: Keys.accent) ?? "") ?? .spotify
        density = DisplayDensity(rawValue: defaults.string(forKey: Keys.density) ?? "") ?? .cozy
        radius = DisplayRadius(rawValue: defaults.string(forKey: Keys.radius) ?? "") ?? .soft
        artwork = ArtworkPref(rawValue: defaults.string(forKey: Keys.artwork) ?? "") ?? .show
        timeDisplay = TimeDisplayPref(rawValue: defaults.string(forKey: Keys.timeDisplay) ?? "") ?? .absolute
        switch defaults.string(forKey: Keys.colorScheme) {
        case "dark": preferredColorScheme = .dark
        case "light": preferredColorScheme = .light
        case "system": preferredColorScheme = nil
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
