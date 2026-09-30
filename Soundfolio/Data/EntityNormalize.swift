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

    /// Same release under a different edition or soundtrack suffix. Keep in sync with `albumReleaseKey` in `lib/entity-normalize.ts`.
    static func albumReleaseKey(_ albumName: String) -> String {
        stripAlbumPunctuation(stripAlbumEdition(albumName))
    }

    static func sameAlbum(_ a: String, _ b: String) -> Bool {
        let left = albumReleaseKey(a)
        let right = albumReleaseKey(b)
        return !left.isEmpty && left == right
    }

    static func preferAlbumTitle(_ current: String, _ candidate: String) -> String {
        let left = label(current)
        let right = label(candidate)
        if left.isEmpty { return right }
        if right.isEmpty { return left }
        if albumReleaseKey(left) != albumReleaseKey(right) { return left }
        let leftPlain = isPlainAlbumTitle(left)
        let rightPlain = isPlainAlbumTitle(right)
        if leftPlain != rightPlain { return rightPlain ? right : left }
        return displayScore(right) > displayScore(left) ? right : left
    }

    static func albumGroupKey(albumName: String, artistName: String) -> String {
        "\(albumReleaseKey(albumName))\0\(artistGroupKey(artistName: artistName))"
    }

    private static let albumEdition = try! NSRegularExpression(
        pattern: #"(?i)(?:\s*[(\[][^()\[\]]*(?:remaster(?:ed)?|deluxe|expanded|anniversary|bonus|original motion picture soundtrack|music from the motion picture|original soundtrack(?: recording)?|soundtrack from and inspired by[^()\]]*)[^()\[\]]*[)\]])+"#
    )

    private static let albumPunctuation = try! NSRegularExpression(pattern: #"[^\p{L}\p{N}\p{M}\s']+"#)

    private static func stripAlbumEdition(_ albumName: String) -> String {
        var value = foldAlbumText(albumName)
        var previous = ""
        while value != previous {
            previous = value
            let range = NSRange(value.startIndex..., in: value)
            value = albumEdition.stringByReplacingMatches(in: value, range: range, withTemplate: " ")
            value = value.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return value
    }

    private static func isPlainAlbumTitle(_ albumName: String) -> Bool {
        foldAlbumText(albumName) == stripAlbumEdition(albumName)
    }

    private static func foldAlbumText(_ albumName: String) -> String {
        albumName
            .precomposedStringWithCanonicalMapping
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased(with: Locale(identifier: "en_US"))
            .replacingOccurrences(of: "’", with: "'")
            .replacingOccurrences(of: "‘", with: "'")
            .replacingOccurrences(of: "“", with: "\"")
            .replacingOccurrences(of: "”", with: "\"")
            .replacingOccurrences(of: "‐", with: "-")
            .replacingOccurrences(of: "‑", with: "-")
            .replacingOccurrences(of: "–", with: "-")
            .replacingOccurrences(of: "—", with: "-")
    }

    private static func stripAlbumPunctuation(_ albumName: String) -> String {
        let range = NSRange(albumName.startIndex..., in: albumName)
        let stripped = albumPunctuation.stringByReplacingMatches(in: albumName, range: range, withTemplate: " ")
        return stripped
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func displayScore(_ value: String) -> Int {
        let titled = value.split(separator: " ").filter { word in
            guard let first = word.first else { return false }
            return first.isUppercase
        }.count
        return titled * 10 + value.count
    }

    static func artistGroupKey(artistName: String) -> String {
        key(artistName)
    }
}
