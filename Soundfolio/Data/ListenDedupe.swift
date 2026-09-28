import Foundation

enum ListenDedupe {
    static let crossSourceWindow: TimeInterval = 90

    static func isLastFmScrobbleId(_ trackId: String) -> Bool {
        let id = trackId.trimmingCharacters(in: .whitespacesAndNewlines)
        return id.hasPrefix("lfm-") && !id.hasPrefix("lfm-track-")
    }

    static func dedupe(_ rows: [StreamRecord]) -> [StreamRecord] {
        var groups: [String: [Int]] = [:]
        for (index, row) in rows.enumerated() where !row.isDemo {
            let key = "\(EntityNormalize.key(row.artistName))\u{0}\(EntityNormalize.key(row.trackName))"
            groups[key, default: []].append(index)
        }

        var drop = Set<Int>()
        for indices in groups.values {
            let sorted = indices.sorted { lhs, rhs in
                let delta = rows[lhs].playedAt.timeIntervalSince(rows[rhs].playedAt)
                if delta != 0 { return delta < 0 }
                return isLastFmScrobbleId(rows[lhs].trackId) == false && isLastFmScrobbleId(rows[rhs].trackId)
            }
            var kept: [Int] = []
            for index in sorted {
                if let matchAt = kept.firstIndex(where: { listensCollide(rows[$0], rows[index]) }) {
                    let keptIndex = kept[matchAt]
                    if prefer(rows[index], over: rows[keptIndex]) {
                        drop.insert(keptIndex)
                        kept[matchAt] = index
                    } else {
                        drop.insert(index)
                    }
                } else {
                    kept.append(index)
                }
            }
        }

        if drop.isEmpty { return rows }
        return rows.enumerated().compactMap { drop.contains($0.offset) ? nil : $0.element }
    }

    private static func listensCollide(_ left: StreamRecord, _ right: StreamRecord) -> Bool {
        if left.playedAt == right.playedAt { return true }
        let leftLastFm = isLastFmScrobbleId(left.trackId)
        let rightLastFm = isLastFmScrobbleId(right.trackId)
        if leftLastFm == rightLastFm { return false }
        return abs(left.playedAt.timeIntervalSince(right.playedAt)) <= crossSourceWindow
    }

    private static func prefer(_ candidate: StreamRecord, over current: StreamRecord) -> Bool {
        let candidateLastFm = isLastFmScrobbleId(candidate.trackId)
        let currentLastFm = isLastFmScrobbleId(current.trackId)
        if candidateLastFm != currentLastFm { return !candidateLastFm }
        return candidate.playedAt < current.playedAt
    }
}
