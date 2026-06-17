import Foundation

struct StatsTimeRange {
    let since: Date?
    let until: Date?
    let label: String
}

enum StatsEngine {
    static func parseTimeRange(preferences: StatsPreferences) -> StatsTimeRange {
        let calendar = Calendar.current
        let now = Date()

        if preferences.usesCustomRange {
            let formatter = DateFormatter()
            formatter.calendar = calendar
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = calendar.timeZone
            formatter.dateFormat = "yyyy-MM-dd"
            if
                let fromDate = formatter.date(from: preferences.customFrom),
                let toDate = formatter.date(from: preferences.customTo)
            {
                let start = calendar.startOfDay(for: min(fromDate, toDate))
                let end = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: max(fromDate, toDate)) ?? now
                return StatsTimeRange(since: start, until: end, label: "\(preferences.customFrom) – \(preferences.customTo)")
            }
        }

        switch preferences.period {
        case .thirtyDays:
            return StatsTimeRange(since: calendar.date(byAdding: .day, value: -30, to: now), until: now, label: "Last 30 days")
        case .threeMonths:
            return StatsTimeRange(since: calendar.date(byAdding: .month, value: -3, to: now), until: now, label: "Last 3 months")
        case .sixMonths:
            return StatsTimeRange(since: calendar.date(byAdding: .month, value: -6, to: now), until: now, label: "Last 6 months")
        case .oneYear:
            return StatsTimeRange(since: calendar.date(byAdding: .year, value: -1, to: now), until: now, label: "Last year")
        case .ytd:
            let start = calendar.date(from: calendar.dateComponents([.year], from: now)) ?? now
            return StatsTimeRange(since: start, until: now, label: "This year")
        case .all:
            return StatsTimeRange(since: nil, until: nil, label: "All time")
        }
    }

    private static func filtered(_ streams: [StreamRecord], range: StatsTimeRange) -> [StreamRecord] {
        streams.filter { stream in
            guard stream.durationMs > 0 else { return false }
            if let since = range.since, stream.playedAt < since { return false }
            if let until = range.until, stream.playedAt > until { return false }
            return true
        }
    }

    static func buildOverview(streams: [StreamRecord], preferences: StatsPreferences) -> OverviewResponse {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let totals = OverviewTotals(
            totalStreams: rows.count,
            totalMinutes: Int(totalMs / 60_000),
            totalHours: Int(totalMs / 3_600_000)
        )
        let diversity = OverviewDiversity(
            uniqueTracks: Set(rows.map(\.trackId)).count,
            uniqueArtists: Set(rows.map(\.artistName)).count
        )
        let spanDates = rows.map(\.playedAt)
        let span: OverviewSpan? = spanDates.isEmpty ? nil : OverviewSpan(
            first: ISO8601DateFormatter().string(from: spanDates.min() ?? Date()),
            last: ISO8601DateFormatter().string(from: spanDates.max() ?? Date())
        )
        let calendarDays = max(1, daysInRange(filter, spanDates: spanDates))
        let avgMin = totals.totalMinutes / calendarDays
        let avgStreams = totals.totalStreams / calendarDays
        let latest = streams.first?.playedAt

        return OverviewResponse(
            filter: FilterLabel(label: filter.label),
            sortBy: preferences.sort.rawValue,
            timeZone: TimeZone.current.identifier,
            hasData: totals.totalStreams > 0,
            totals: totals,
            diversity: diversity,
            span: span,
            latestPlayAt: latest.map { ISO8601DateFormatter().string(from: $0) },
            calendarDays: calendarDays,
            avgMinPerDay: avgMin,
            avgStreamsPerDay: avgStreams,
            metrics: [
                OverviewMetric(label: "Minutes", value: "\(totals.totalMinutes)", hint: "\(totals.totalHours) h"),
                OverviewMetric(label: "Streams", value: "\(totals.totalStreams)", hint: nil),
                OverviewMetric(label: "Tracks", value: "\(diversity.uniqueTracks)", hint: "unique"),
                OverviewMetric(label: "Artists", value: "\(diversity.uniqueArtists)", hint: "unique"),
                OverviewMetric(label: "Min / day", value: "\(avgMin)", hint: "~\(calendarDays) d"),
                OverviewMetric(label: "Plays / day", value: "\(avgStreams)", hint: nil),
            ],
            topTracks: topTracks(from: rows, sort: preferences.sort, limit: 5),
            topArtists: topArtists(from: rows, sort: preferences.sort, limit: 5),
            topAlbums: topAlbums(from: rows, sort: preferences.sort, limit: 5)
        )
    }

    static func topTracks(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopTrackItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? streams.filter { $0.durationMs > 0 }
        var groups: [String: (trackName: String, artistName: String, albumName: String, albumArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = "\(row.trackName)\0\(row.artistName)"
            var group = groups[key] ?? (row.trackName, row.artistName, row.albumName, row.albumArt, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            if group.albumArt == nil, let art = row.albumArt {
                group.albumArt = art
                group.albumName = row.albumName
            }
            groups[key] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ($0.durationMs / 60_000) > ($1.durationMs / 60_000) }
            .prefix(limit)
            .map {
                TopTrackItem(
                    trackId: "\($0.trackName)\0\($0.artistName)",
                    trackName: $0.trackName,
                    artistName: $0.artistName,
                    albumName: $0.albumName,
                    albumArt: $0.albumArt,
                    streams: $0.streams,
                    minutesListened: $0.durationMs / 60_000
                )
            }
    }

    static func topArtists(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopArtistItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? streams.filter { $0.durationMs > 0 }
        var groups: [String: (artistName: String, artistArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            var group = groups[row.artistName] ?? (row.artistName, nil, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            if group.artistArt == nil, let art = row.artistArt { group.artistArt = art }
            groups[row.artistName] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ($0.durationMs / 60_000) > ($1.durationMs / 60_000) }
            .prefix(limit)
            .map {
                TopArtistItem(
                    artistName: $0.artistName,
                    artistArt: $0.artistArt,
                    streams: $0.streams,
                    minutesListened: $0.durationMs / 60_000
                )
            }
    }

    static func topAlbums(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopAlbumItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? streams.filter { $0.durationMs > 0 }
        var groups: [String: (albumName: String, artistName: String, albumArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = "\(row.albumName)\0\(row.artistName)"
            var group = groups[key] ?? (row.albumName, row.artistName, row.albumArt, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            if group.albumArt == nil, let art = row.albumArt { group.albumArt = art }
            groups[key] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ($0.durationMs / 60_000) > ($1.durationMs / 60_000) }
            .prefix(limit)
            .map {
                TopAlbumItem(
                    albumName: $0.albumName,
                    artistName: $0.artistName,
                    albumArt: $0.albumArt,
                    streams: $0.streams,
                    minutesListened: $0.durationMs / 60_000
                )
            }
    }

    static func recentStreams(from streams: [StreamRecord], limit: Int) -> [RecentStream] {
        streams
            .filter { $0.playedAt <= Date() }
            .prefix(limit)
            .map {
                RecentStream(
                    id: $0.id,
                    trackId: $0.trackId,
                    trackName: $0.trackName,
                    artistName: $0.artistName,
                    albumName: $0.albumName,
                    albumArt: $0.albumArt,
                    artistArt: $0.artistArt,
                    playedAt: ISO8601DateFormatter().string(from: $0.playedAt),
                    isNowPlaying: false
                )
            }
    }

    static func historyPoints(from streams: [StreamRecord], preferences: StatsPreferences) -> [HistoryPoint] {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let calendar = Calendar.current
        var buckets: [String: (minutes: Int, streams: Int)] = [:]

        for row in rows {
            let key: String
            switch preferences.chartGroupBy {
            case .months:
                key = monthKey(for: row.playedAt, calendar: calendar)
            case .weeks:
                key = weekKey(for: row.playedAt, calendar: calendar)
            case .days:
                key = dayKey(for: row.playedAt, calendar: calendar)
            }
            var bucket = buckets[key] ?? (0, 0)
            bucket.streams += 1
            bucket.minutes += row.durationMs / 60_000
            buckets[key] = bucket
        }

        return buckets.keys.sorted().map { label in
            let bucket = buckets[label] ?? (0, 0)
            return HistoryPoint(label: label, minutes: bucket.minutes, streams: bucket.streams)
        }
    }

    static func patterns(from streams: [StreamRecord], preferences: StatsPreferences) -> PatternsResponse {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let calendar = Calendar.current
        var byHour = Array(repeating: (minutes: 0, streams: 0), count: 24)
        var byDay = Array(repeating: (minutes: 0, streams: 0), count: 7)
        var heatCounts = Array(repeating: 0, count: 7 * 24)

        for row in rows {
            let hour = calendar.component(.hour, from: row.playedAt)
            let weekday = calendar.component(.weekday, from: row.playedAt) - 1
            byHour[hour].streams += 1
            byHour[hour].minutes += row.durationMs / 60_000
            byDay[weekday].streams += 1
            byDay[weekday].minutes += row.durationMs / 60_000
            heatCounts[weekday * 24 + hour] += 1
        }

        let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let hourRows = (0 ..< 24).map {
            PatternsHourDay(
                label: String(format: "%02d:00", $0),
                minutes: byHour[$0].minutes,
                streams: byHour[$0].streams
            )
        }
        let weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
        let dayRows = weekdayOrder.map { day in
            PatternsHourDay(label: dayNames[day], minutes: byDay[day].minutes, streams: byDay[day].streams)
        }
        var grid: [HeatmapCell] = []
        for day in 0 ..< 7 {
            for hour in 0 ..< 24 {
                grid.append(HeatmapCell(day: day, hour: hour, count: heatCounts[day * 24 + hour]))
            }
        }

        return PatternsResponse(
            timeZone: TimeZone.current.identifier,
            byHour: hourRows,
            byDay: dayRows,
            heatmap: HeatmapPayload(grid: grid, dayNames: dayNames)
        )
    }

    private static func daysInRange(_ range: StatsTimeRange, spanDates: [Date]) -> Int {
        let calendar = Calendar.current
        if let since = range.since, let until = range.until {
            return max(1, calendar.dateComponents([.day], from: calendar.startOfDay(for: since), to: calendar.startOfDay(for: until)).day ?? 1)
        }
        guard let first = spanDates.min(), let last = spanDates.max() else { return 1 }
        return max(1, calendar.dateComponents([.day], from: calendar.startOfDay(for: first), to: calendar.startOfDay(for: last)).day ?? 1)
    }

    private static func dayKey(for date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    private static func monthKey(for date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month], from: date)
        return String(format: "%04d-%02d", components.year ?? 0, components.month ?? 0)
    }

    private static func weekKey(for date: Date, calendar: Calendar) -> String {
        let start = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
        return dayKey(for: start, calendar: calendar)
    }
}
