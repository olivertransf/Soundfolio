import Foundation

/// Cuts overlapping listens. Mirrors `creditListenDurations` in `lib/listen-credit.ts`.
enum ListenCredit {
    static func isEndAnchored(trackId: String, durationMs: Int) -> Bool {
        if trackId.hasPrefix("lfm-") { return false }
        if durationMs >= 120_000 && durationMs % 1000 == 0 { return false }
        return true
    }

    static func credit(_ rows: [StreamRecord]) -> [StreamRecord] {
        guard rows.count > 1 else { return rows }

        struct Window {
            let index: Int
            let start: Int
            var end: Int
        }

        var windows: [Window] = rows.enumerated().map { index, row in
            let at = Int((row.playedAt.timeIntervalSince1970 * 1000).rounded())
            let duration = max(0, row.catalogDurationMs)
            if isEndAnchored(trackId: row.trackId, durationMs: duration) {
                return Window(index: index, start: at - duration, end: at)
            }
            return Window(index: index, start: at, end: at + duration)
        }
        windows.sort { lhs, rhs in
            if lhs.start != rhs.start { return lhs.start < rhs.start }
            if lhs.end != rhs.end { return lhs.end < rhs.end }
            return lhs.index < rhs.index
        }

        var credited = Array(repeating: 0, count: rows.count)
        for index in windows.indices {
            var end = windows[index].end
            if index + 1 < windows.count, end > windows[index + 1].start {
                end = windows[index + 1].start
            }
            credited[windows[index].index] = max(0, end - windows[index].start)
        }

        return rows.enumerated().map { index, row in
            let ms = credited[index]
            if ms == row.durationMs { return row }
            return StreamRecord(
                id: row.id,
                trackId: row.trackId,
                trackName: row.trackName,
                artistName: row.artistName,
                artistArt: row.artistArt,
                albumName: row.albumName,
                albumArt: row.albumArt,
                durationMs: ms,
                playedAt: row.playedAt,
                isDemo: row.isDemo,
                catalogDurationMs: row.catalogDurationMs
            )
        }
    }
}
