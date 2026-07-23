import Foundation

enum ListeningMinutes {
    /// Whole minutes from accumulated listen duration. Matches JS `Math.round(ms / 60000)`.
    static func minutes(fromMs ms: Int) -> Int {
        Int((Double(ms) / 60_000).rounded(.toNearestOrAwayFromZero))
    }

    /// Whole hours from accumulated listen duration. Matches JS `Math.round(ms / 3600000)`.
    static func hours(fromMs ms: Int) -> Int {
        Int((Double(ms) / 3_600_000).rounded(.toNearestOrAwayFromZero))
    }
}
