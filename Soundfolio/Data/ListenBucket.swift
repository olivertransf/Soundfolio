import Foundation

/// Hour-of-day anchor. Mirrors `getListenBucketInstant` in `lib/stats-timezone.ts`.
enum ListenBucket {
    static func instant(playedAt: Date, durationMs: Int, trackId: String, timeZone: TimeZone = .current) -> Date {
        if trackId.hasPrefix("lfm-") {
            let anchor = correctLastFmPlayedAt(playedAt, timeZone: timeZone)
            return anchor.addingTimeInterval(-Double(max(0, durationMs)) / 1000)
        }

        var anchor = playedAt
        if milliseconds(playedAt) == 0 && spotifyImportLooksMisParsed(playedAt, timeZone: timeZone) {
            anchor = fixWallTimeStoredAsUtc(playedAt, timeZone: timeZone)
        }

        if durationMs >= 120_000 && durationMs % 1000 == 0 {
            return anchor
        }
        return anchor.addingTimeInterval(-Double(max(0, durationMs)) / 1000)
    }

    private static func milliseconds(_ date: Date) -> Int {
        let ms = date.timeIntervalSince1970.truncatingRemainder(dividingBy: 1) * 1000
        return Int(ms.rounded())
    }

    private static func hour(_ date: Date, timeZone: TimeZone) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.component(.hour, from: date)
    }

    private static func lastFmLooksWallTimeAsUtc(_ date: Date, timeZone: TimeZone) -> Bool {
        let value = hour(date, timeZone: timeZone)
        return value >= 2 && value <= 6
    }

    private static func spotifyImportLooksMisParsed(_ date: Date, timeZone: TimeZone) -> Bool {
        let value = hour(date, timeZone: timeZone)
        return value <= 6 || (value >= 14 && value <= 16)
    }

    private static func correctLastFmPlayedAt(_ date: Date, timeZone: TimeZone) -> Date {
        guard lastFmLooksWallTimeAsUtc(date, timeZone: timeZone) else { return date }
        return fixWallTimeStoredAsUtc(date, timeZone: timeZone)
    }

    private static func fixWallTimeStoredAsUtc(_ date: Date, timeZone: TimeZone) -> Date {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let parts = utc.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: date)
        var local = Calendar(identifier: .gregorian)
        local.timeZone = timeZone
        return local.date(from: parts) ?? date
    }
}
