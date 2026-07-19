import Foundation

enum ArtURL {
    /// Last.fm white-star placeholder hash — same filter as web `isUsableArtUrl`.
    private static let placeholderHash = "2a96cbd8b46e442fc41c2b86b821562f"

    static func isUsable(_ url: String?) -> Bool {
        guard let url, !url.isEmpty else { return false }
        return !url.contains(placeholderHash)
    }
}
