import Foundation

enum EntityNormalize {
    static func isCatalogTrackId(_ trackId: String) -> Bool {
        let id = trackId.trimmingCharacters(in: .whitespacesAndNewlines)
        if id.isEmpty { return false }
        if id.hasPrefix("lfm-") && !id.hasPrefix("lfm-track-") { return false }
        return true
    }

    static func key(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased()
    }

    static func label(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }

    static func matches(_ a: String, _ b: String) -> Bool {
        key(a) == key(b)
    }

    static func betterDisplay(_ current: String, _ candidate: String) -> String {
        let left = label(current)
        let right = label(candidate)
        if left.isEmpty { return right }
        if right.isEmpty { return left }
        if key(left) != key(right) { return left }

        func score(_ value: String) -> Int {
            let titled = value.split(separator: " ").filter { word in
                guard let first = word.first else { return false }
                return first.isUppercase
            }.count
            return titled * 10 + value.count
        }

        return score(right) > score(left) ? right : left
    }

    static func trackGroupKey(trackId: String, trackName: String, artistName: String) -> String {
        if isCatalogTrackId(trackId) {
            return "id:\(trackId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
        }
        return "name:\(key(trackName))\0\(key(artistName))"
    }

    static func catalogTrackId(trackId: String, trackName: String, artistName: String) -> String {
        if isCatalogTrackId(trackId) {
            return trackId.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return trackGroupKey(trackId: "", trackName: trackName, artistName: artistName)
    }

    static func albumGroupKey(albumName: String, artistName: String) -> String {
        "\(key(albumName))\0\(key(artistName))"
    }

    static func artistGroupKey(artistName: String) -> String {
        key(artistName)
    }
}
