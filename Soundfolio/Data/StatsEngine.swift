import Foundation

struct StatsTimeRange {
    let since: Date?
    let until: Date?
    let label: String
}

enum HistoryGrain {
    case days
    case weeks
    case months
}

struct PeriodBreakdown {
    let dayparts: [HistoryPoint]
    let weekParts: [HistoryPoint]
    let artistShare: [HistoryPoint]
    let replays: [HistoryPoint]
    let peakHour: String
    let peakHourMinutes: Int
    let averageMinutesPerPlay: Int
    let activeDays: Int
    let replayShare: Int
}

struct InsightSummary {
    let uniqueAlbums: Int
    let mostActiveDay: String?
    let mostActiveMinutes: Int
    let topTenShare: Int
    let topTenMinutes: Int
    let restMinutes: Int
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

    private static func timed(_ streams: [StreamRecord]) -> [StreamRecord] {
        ListenCredit.credit(ListenDedupe.dedupe(streams.filter { !$0.isDemo && $0.durationMs > 0 }))
    }

    private static func filtered(_ streams: [StreamRecord], range: StatsTimeRange) -> [StreamRecord] {
        timed(streams).filter { stream in
            guard stream.durationMs > 0 else { return false }
            if let since = range.since, stream.playedAt < since { return false }
            if let until = range.until, stream.playedAt > until { return false }
            return true
        }
    }

    private static func credited(_ streams: [StreamRecord]) -> [StreamRecord] {
        timed(streams).filter { $0.durationMs > 0 }
    }

    private static func trackKey(for row: StreamRecord) -> String {
        EntityNormalize.trackGroupKey(trackId: row.trackId, trackName: row.trackName, artistName: row.artistName)
    }

    static func buildOverview(streams: [StreamRecord], preferences: StatsPreferences) -> OverviewResponse {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let totals = OverviewTotals(
            totalStreams: rows.count,
            totalMinutes: ListeningMinutes.minutes(fromMs: totalMs),
            totalHours: ListeningMinutes.hours(fromMs: totalMs)
        )
        let diversity = OverviewDiversity(
            uniqueTracks: Set(rows.map { trackKey(for: $0) }).count,
            uniqueArtists: Set(rows.map { EntityNormalize.artistGroupKey(artistName: $0.artistName) }).count
        )
        let spanDates = rows.map(\.playedAt)
        let span: OverviewSpan? = spanDates.isEmpty ? nil : OverviewSpan(
            first: ISO8601DateFormatter().string(from: spanDates.min() ?? Date()),
            last: ISO8601DateFormatter().string(from: spanDates.max() ?? Date())
        )
        let calendarDays = max(1, daysInRange(filter, spanDates: spanDates))
        let avgMin = totals.totalMinutes / calendarDays
        let avgStreams = totals.totalStreams / calendarDays
        let latestInPeriod = rows.map(\.playedAt).max()
        let latestGlobal = streams.first(where: { !$0.isDemo })?.playedAt

        return OverviewResponse(
            filter: FilterLabel(label: filter.label),
            sortBy: preferences.sort.rawValue,
            timeZone: TimeZone.current.identifier,
            hasData: totals.totalStreams > 0,
            totals: totals,
            diversity: diversity,
            span: span,
            latestPlayAt: latestInPeriod.map { ISO8601DateFormatter().string(from: $0) },
            latestPlayAtGlobal: latestGlobal.map { ISO8601DateFormatter().string(from: $0) },
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
            topTracks: topTracks(from: streams, sort: preferences.sort, limit: preferences.listDepth.dashboardTops, range: filter),
            topArtists: topArtists(from: streams, sort: preferences.sort, limit: preferences.listDepth.dashboardTops, range: filter),
            topAlbums: topAlbums(from: streams, sort: preferences.sort, limit: preferences.listDepth.dashboardTops, range: filter)
        )
    }

    static func topTracks(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopTrackItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? credited(streams)
        var groups: [String: (trackId: String, trackName: String, artistName: String, albumName: String, albumArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = trackKey(for: row)
            var group = groups[key] ?? (row.trackId, row.trackName, row.artistName, row.albumName, row.albumArt, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            group.trackName = EntityNormalize.betterDisplay(group.trackName, row.trackName)
            group.artistName = EntityNormalize.betterDisplay(group.artistName, row.artistName)
            group.albumName = EntityNormalize.preferAlbumTitle(group.albumName, row.albumName)
            if group.albumArt == nil, let art = row.albumArt {
                group.albumArt = art
                group.albumName = EntityNormalize.preferAlbumTitle(group.albumName, row.albumName)
            }
            groups[key] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ListeningMinutes.minutes(fromMs: $0.durationMs) > ListeningMinutes.minutes(fromMs: $1.durationMs) }
            .prefix(limit)
            .map {
                TopTrackItem(
                    trackId: EntityNormalize.catalogTrackId(trackId: $0.trackId, trackName: $0.trackName, artistName: $0.artistName),
                    trackName: $0.trackName,
                    artistName: $0.artistName,
                    albumName: $0.albumName,
                    albumArt: $0.albumArt,
                    streams: $0.streams,
                    minutesListened: ListeningMinutes.minutes(fromMs: $0.durationMs)
                )
            }
    }

    static func topArtists(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopArtistItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? credited(streams)
        var groups: [String: (artistName: String, artistArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = EntityNormalize.artistGroupKey(artistName: row.artistName)
            var group = groups[key] ?? (row.artistName, nil, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            group.artistName = EntityNormalize.betterDisplay(group.artistName, row.artistName)
            if group.artistArt == nil, let art = row.artistArt { group.artistArt = art }
            groups[key] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ListeningMinutes.minutes(fromMs: $0.durationMs) > ListeningMinutes.minutes(fromMs: $1.durationMs) }
            .prefix(limit)
            .map {
                TopArtistItem(
                    artistName: $0.artistName,
                    artistArt: $0.artistArt,
                    streams: $0.streams,
                    minutesListened: ListeningMinutes.minutes(fromMs: $0.durationMs)
                )
            }
    }

    static func topAlbums(from streams: [StreamRecord], sort: TopSortMode, limit: Int, range: StatsTimeRange? = nil) -> [TopAlbumItem] {
        let rows = range.map { filtered(streams, range: $0) } ?? credited(streams)
        var groups: [String: (albumName: String, artistName: String, albumArt: String?, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = EntityNormalize.albumGroupKey(albumName: row.albumName, artistName: row.artistName)
            var group = groups[key] ?? (row.albumName, row.artistName, row.albumArt, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            group.albumName = EntityNormalize.preferAlbumTitle(group.albumName, row.albumName)
            group.artistName = EntityNormalize.betterDisplay(group.artistName, row.artistName)
            if group.albumArt == nil, let art = row.albumArt { group.albumArt = art }
            groups[key] = group
        }
        return groups.values
            .sorted { sort == .streams ? $0.streams > $1.streams : ListeningMinutes.minutes(fromMs: $0.durationMs) > ListeningMinutes.minutes(fromMs: $1.durationMs) }
            .prefix(limit)
            .map {
                TopAlbumItem(
                    albumName: $0.albumName,
                    artistName: $0.artistName,
                    albumArt: $0.albumArt,
                    streams: $0.streams,
                    minutesListened: ListeningMinutes.minutes(fromMs: $0.durationMs)
                )
            }
    }

    static func recentStreams(from streams: [StreamRecord], limit: Int, preferences: StatsPreferences? = nil) -> [RecentStream] {
        let rows: [StreamRecord]
        if let preferences {
            let range = parseTimeRange(preferences: preferences)
            rows = filtered(streams, range: range)
        } else {
            rows = ListenDedupe.dedupe(streams.filter { !$0.isDemo })
        }
        return rows
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
        var buckets: [String: (durationMs: Int, streams: Int)] = [:]

        for row in rows {
            let key = weekKey(for: row.playedAt, calendar: calendar)
            var bucket = buckets[key] ?? (0, 0)
            bucket.streams += 1
            bucket.durationMs += row.durationMs
            buckets[key] = bucket
        }

        let cap = 26

        return buckets.keys.sorted().suffix(cap).reversed().map { label in
            let bucket = buckets[label] ?? (0, 0)
            return HistoryPoint(
                label: label,
                minutes: ListeningMinutes.minutes(fromMs: bucket.durationMs),
                streams: bucket.streams
            )
        }
    }

    static func historySeries(
        from streams: [StreamRecord],
        preferences: StatsPreferences,
        grain: HistoryGrain
    ) -> [HistoryPoint] {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let calendar = Calendar.current
        var buckets: [String: (durationMs: Int, streams: Int)] = [:]

        for row in rows {
            let key: String
            switch grain {
            case .days:
                key = dayKey(for: row.playedAt, calendar: calendar)
            case .weeks:
                key = weekKey(for: row.playedAt, calendar: calendar)
            case .months:
                key = monthKey(for: row.playedAt, calendar: calendar)
            }
            var bucket = buckets[key] ?? (0, 0)
            bucket.streams += 1
            bucket.durationMs += row.durationMs
            buckets[key] = bucket
        }

        return buckets.keys.sorted().suffix(160).reversed().map { label in
            let bucket = buckets[label] ?? (0, 0)
            return HistoryPoint(
                label: label,
                minutes: ListeningMinutes.minutes(fromMs: bucket.durationMs),
                streams: bucket.streams
            )
        }
    }

    static func insightSummary(from streams: [StreamRecord], preferences: StatsPreferences) -> InsightSummary {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let albums = Set(rows.filter { !EntityNormalize.key($0.albumName).isEmpty }.map {
            EntityNormalize.albumGroupKey(albumName: $0.albumName, artistName: $0.artistName)
        })
        let tops = topTracks(from: streams, sort: .minutes, limit: 10, range: filter)
        let topMinutes = tops.reduce(0) { $0 + $1.minutesListened }
        let totalMinutes = ListeningMinutes.minutes(fromMs: totalMs)
        let share = totalMinutes > 0 ? Int((Double(topMinutes) / Double(totalMinutes) * 100).rounded()) : 0

        let calendar = Calendar.current
        var byDay: [String: (durationMs: Int, streams: Int)] = [:]
        for row in rows {
            let key = dayKey(for: row.playedAt, calendar: calendar)
            var bucket = byDay[key] ?? (0, 0)
            bucket.streams += 1
            bucket.durationMs += row.durationMs
            byDay[key] = bucket
        }
        let best = byDay.max { lhs, rhs in
            let leftMinutes = ListeningMinutes.minutes(fromMs: lhs.value.durationMs)
            let rightMinutes = ListeningMinutes.minutes(fromMs: rhs.value.durationMs)
            if leftMinutes == rightMinutes { return lhs.value.streams < rhs.value.streams }
            return leftMinutes < rightMinutes
        }

        return InsightSummary(
            uniqueAlbums: albums.count,
            mostActiveDay: best?.key,
            mostActiveMinutes: ListeningMinutes.minutes(fromMs: best?.value.durationMs ?? 0),
            topTenShare: share,
            topTenMinutes: topMinutes,
            restMinutes: max(0, totalMinutes - topMinutes)
        )
    }

    static func periodBreakdown(from streams: [StreamRecord], preferences: StatsPreferences) -> PeriodBreakdown {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let calendar = Calendar.current
        var daypartMs = Array(repeating: 0, count: 4)
        var daypartPlays = Array(repeating: 0, count: 4)
        var weekdayMs = 0
        var weekdayPlays = 0
        var weekendMs = 0
        var weekendPlays = 0
        var totalMs = 0
        var days = Set<String>()
        var tracks: [String: (plays: Int, durationMs: Int)] = [:]
        var byHour = Array(repeating: 0, count: 24)

        for row in rows {
            let instant = ListenBucket.instant(
                playedAt: row.playedAt,
                durationMs: row.catalogDurationMs,
                trackId: row.trackId,
                timeZone: calendar.timeZone
            )
            let hour = calendar.component(.hour, from: instant)
            let part = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3
            daypartMs[part] += row.durationMs
            daypartPlays[part] += 1
            byHour[hour] += row.durationMs
            let weekday = calendar.component(.weekday, from: instant)
            if weekday == 1 || weekday == 7 {
                weekendMs += row.durationMs
                weekendPlays += 1
            } else {
                weekdayMs += row.durationMs
                weekdayPlays += 1
            }
            totalMs += row.durationMs
            days.insert(dayKey(for: row.playedAt, calendar: calendar))
            let key = trackKey(for: row)
            var group = tracks[key] ?? (plays: 0, durationMs: 0)
            group.plays += 1
            group.durationMs += row.durationMs
            tracks[key] = group
        }

        var onceMs = 0
        var oncePlays = 0
        var replayMs = 0
        var replayPlays = 0
        for group in tracks.values {
            if group.plays <= 1 {
                onceMs += group.durationMs
                oncePlays += group.plays
            } else {
                replayMs += group.durationMs
                replayPlays += group.plays
            }
        }

        let totalMinutes = ListeningMinutes.minutes(fromMs: totalMs)
        let replayMinutes = ListeningMinutes.minutes(fromMs: replayMs)
        let artists = topArtists(
            from: rows,
            sort: .minutes,
            limit: 5,
            range: StatsTimeRange(since: nil, until: nil, label: "")
        )
        let topArtistMinutes = artists.reduce(0) { $0 + $1.minutesListened }
        var artistPoints = artists.map {
            HistoryPoint(label: $0.artistName, minutes: $0.minutesListened, streams: $0.streams)
        }
        let rest = max(0, totalMinutes - topArtistMinutes)
        if rest > 0 {
            artistPoints.append(HistoryPoint(label: "Rest", minutes: rest, streams: 0))
        }

        let peakIndex = byHour.enumerated().max(by: { $0.element < $1.element })?.offset ?? 0
        let peakHour12 = peakIndex % 12 == 0 ? 12 : peakIndex % 12
        let peakLabel = rows.isEmpty ? "—" : "\(peakHour12)\(peakIndex < 12 ? "a" : "p")"
        let labels = ["Night", "Morning", "Afternoon", "Evening"]

        return PeriodBreakdown(
            dayparts: labels.enumerated().map { index, label in
                HistoryPoint(
                    label: label,
                    minutes: ListeningMinutes.minutes(fromMs: daypartMs[index]),
                    streams: daypartPlays[index]
                )
            },
            weekParts: [
                HistoryPoint(label: "Weekday", minutes: ListeningMinutes.minutes(fromMs: weekdayMs), streams: weekdayPlays),
                HistoryPoint(label: "Weekend", minutes: ListeningMinutes.minutes(fromMs: weekendMs), streams: weekendPlays),
            ],
            artistShare: artistPoints,
            replays: [
                HistoryPoint(label: "Played once", minutes: ListeningMinutes.minutes(fromMs: onceMs), streams: oncePlays),
                HistoryPoint(label: "Played again", minutes: replayMinutes, streams: replayPlays),
            ],
            peakHour: peakLabel,
            peakHourMinutes: ListeningMinutes.minutes(fromMs: byHour[peakIndex]),
            averageMinutesPerPlay: rows.isEmpty ? 0 : Int((Double(totalMs) / Double(rows.count) / 60_000).rounded()),
            activeDays: days.count,
            replayShare: totalMinutes > 0 ? Int((Double(replayMinutes) / Double(totalMinutes) * 100).rounded()) : 0
        )
    }

    static func patterns(from streams: [StreamRecord], preferences: StatsPreferences) -> PatternsResponse {
        let filter = parseTimeRange(preferences: preferences)
        let rows = filtered(streams, range: filter)
        let calendar = Calendar.current
        var byHour = Array(repeating: (durationMs: 0, streams: 0), count: 24)
        var byDay = Array(repeating: (durationMs: 0, streams: 0), count: 7)
        var heatCounts = Array(repeating: 0, count: 7 * 24)

        for row in rows {
            let instant = ListenBucket.instant(
                playedAt: row.playedAt,
                durationMs: row.catalogDurationMs,
                trackId: row.trackId,
                timeZone: calendar.timeZone
            )
            let hour = calendar.component(.hour, from: instant)
            let weekday = calendar.component(.weekday, from: instant) - 1
            byHour[hour].streams += 1
            byHour[hour].durationMs += row.durationMs
            byDay[weekday].streams += 1
            byDay[weekday].durationMs += row.durationMs
            heatCounts[weekday * 24 + hour] += 1
        }

        let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let hourRows = (0 ..< 24).map {
            PatternsHourDay(
                label: String(format: "%02d:00", $0),
                minutes: ListeningMinutes.minutes(fromMs: byHour[$0].durationMs),
                streams: byHour[$0].streams
            )
        }
        let weekdayOrder = [1, 2, 3, 4, 5, 6, 0]
        let dayRows = weekdayOrder.map { day in
            PatternsHourDay(
                label: dayNames[day],
                minutes: ListeningMinutes.minutes(fromMs: byDay[day].durationMs),
                streams: byDay[day].streams
            )
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

    static func peakHour(from patterns: PatternsResponse) -> PatternsHourDay? {
        patterns.byHour.max { lhs, rhs in
            lhs.minutes == rhs.minutes ? lhs.streams < rhs.streams : lhs.minutes < rhs.minutes
        }
    }

    static func peakDay(from patterns: PatternsResponse) -> PatternsHourDay? {
        patterns.byDay.max { lhs, rhs in
            lhs.minutes == rhs.minutes ? lhs.streams < rhs.streams : lhs.minutes < rhs.minutes
        }
    }

    static func trackDetail(name: String, artist: String, streams: [StreamRecord], range: StatsTimeRange) -> TrackDetail {
        let rows = filtered(streams, range: range).filter {
            EntityNormalize.matches($0.trackName, name) && EntityNormalize.matches($0.artistName, artist)
        }
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let minutes = ListeningMinutes.minutes(fromMs: totalMs)
        let dates = rows.map(\.playedAt)
        let albumArt = rows.compactMap(\.albumArt).first
        let albumName = rows.first?.albumName ?? ""
        let trackName = rows.reduce(name) { EntityNormalize.betterDisplay($0, $1.trackName) }
        let artistName = rows.reduce(artist) { EntityNormalize.betterDisplay($0, $1.artistName) }
        let ranked = topTracks(from: streams, sort: .minutes, limit: 10_000, range: range)
        let rank = ranked.firstIndex {
            EntityNormalize.matches($0.trackName, name) && EntityNormalize.matches($0.artistName, artist)
        }.map { $0 + 1 }
        return TrackDetail(
            trackName: trackName,
            artistName: artistName,
            albumName: albumName,
            albumArt: albumArt,
            streams: rows.count,
            minutesListened: minutes,
            rank: rank,
            share: periodShare(minutes: minutes, streams: streams, range: range),
            firstPlayedAt: credited(streams).filter {
                EntityNormalize.matches($0.trackName, name) && EntityNormalize.matches($0.artistName, artist)
            }.map(\.playedAt).min(),
            lastPlayedAt: dates.max(),
            recentPlays: recentStreams(from: rows, limit: 20)
        )
    }

    static func artistDetail(name: String, streams: [StreamRecord], range: StatsTimeRange, sort: TopSortMode) -> ArtistDetail {
        let rows = filtered(streams, range: range).filter { EntityNormalize.matches($0.artistName, name) }
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let minutes = ListeningMinutes.minutes(fromMs: totalMs)
        let artistArt = rows.compactMap(\.artistArt).first
        let artistName = rows.reduce(name) { EntityNormalize.betterDisplay($0, $1.artistName) }
        let uniqueTracks = Set(rows.map {
            EntityNormalize.trackGroupKey(trackId: $0.trackId, trackName: $0.trackName, artistName: $0.artistName)
        }).count
        let uniqueAlbums = Set(rows.filter { !EntityNormalize.key($0.albumName).isEmpty }.map {
            EntityNormalize.albumGroupKey(albumName: $0.albumName, artistName: $0.artistName)
        }).count
        return ArtistDetail(
            artistName: artistName,
            artistArt: artistArt,
            streams: rows.count,
            minutesListened: minutes,
            uniqueTracks: uniqueTracks,
            uniqueAlbums: uniqueAlbums,
            share: periodShare(minutes: minutes, streams: streams, range: range),
            topTracks: topTracks(from: rows, sort: sort, limit: 10),
            topAlbums: topAlbums(from: rows, sort: sort, limit: 10)
        )
    }

    static func albumDetail(name: String, artist: String, streams: [StreamRecord], range: StatsTimeRange) -> AlbumDetail {
        let rows = filtered(streams, range: range).filter {
            EntityNormalize.sameAlbum($0.albumName, name) && EntityNormalize.matches($0.artistName, artist)
        }
        let totalMs = rows.reduce(0) { $0 + $1.durationMs }
        let minutes = ListeningMinutes.minutes(fromMs: totalMs)
        var trackGroups: [String: (name: String, streams: Int, durationMs: Int)] = [:]
        for row in rows {
            let key = EntityNormalize.key(row.trackName)
            var group = trackGroups[key] ?? (row.trackName, 0, 0)
            group.streams += 1
            group.durationMs += row.durationMs
            group.name = EntityNormalize.betterDisplay(group.name, row.trackName)
            trackGroups[key] = group
        }
        let tracks = trackGroups.map { _, group in
            AlbumTrackRow(trackName: group.name, streams: group.streams, minutes: ListeningMinutes.minutes(fromMs: group.durationMs))
        }
        .sorted { $0.streams > $1.streams }

        let albumName = rows.reduce(name) { EntityNormalize.preferAlbumTitle($0, $1.albumName) }
        let artistName = rows.reduce(artist) { EntityNormalize.betterDisplay($0, $1.artistName) }
        return AlbumDetail(
            albumName: albumName,
            artistName: artistName,
            albumArt: rows.compactMap(\.albumArt).first,
            streams: rows.count,
            minutesListened: minutes,
            share: periodShare(minutes: minutes, streams: streams, range: range),
            firstPlayedAt: earliestAlbumPlay(name: name, artist: artist, streams: streams),
            tracks: tracks
        )
    }

    private static func earliestAlbumPlay(name: String, artist: String, streams: [StreamRecord]) -> Date? {
        let songs = Set(
            credited(streams)
                .filter {
                    EntityNormalize.sameAlbum($0.albumName, name) && EntityNormalize.matches($0.artistName, artist)
                }
                .map { "\(EntityNormalize.key($0.trackName))\u{0}\(EntityNormalize.key($0.artistName))" }
        )
        guard !songs.isEmpty else { return nil }
        return credited(streams)
            .filter { songs.contains("\(EntityNormalize.key($0.trackName))\u{0}\(EntityNormalize.key($0.artistName))") }
            .map(\.playedAt)
            .min()
    }

    private static func periodShare(minutes: Int, streams: [StreamRecord], range: StatsTimeRange) -> Int {
        let totalMs = filtered(streams, range: range).reduce(0) { $0 + $1.durationMs }
        let total = ListeningMinutes.minutes(fromMs: totalMs)
        guard total > 0 else { return 0 }
        return Int((Double(minutes) / Double(total) * 100).rounded())
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
