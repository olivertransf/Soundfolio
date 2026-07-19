import Foundation

struct OverviewMetric: Codable, Identifiable {
    var id: String { label }
    let label: String
    let value: String
    let hint: String?
}

struct OverviewTotals: Codable {
    let totalStreams: Int
    let totalMinutes: Int
    let totalHours: Int
}

struct OverviewDiversity: Codable {
    let uniqueTracks: Int
    let uniqueArtists: Int
}

struct OverviewSpan: Codable {
    let first: String
    let last: String
}

struct TopTrackItem: Codable, Identifiable {
    var id: String { trackId }
    let trackId: String
    let trackName: String
    let artistName: String
    let albumName: String
    let albumArt: String?
    let streams: Int
    let minutesListened: Int
}

struct TopArtistItem: Codable, Identifiable {
    var id: String { artistName }
    let artistName: String
    let artistArt: String?
    let streams: Int
    let minutesListened: Int
}

struct TopAlbumItem: Codable, Identifiable {
    var id: String { "\(albumName)-\(artistName)" }
    let albumName: String
    let artistName: String
    let albumArt: String?
    let streams: Int
    let minutesListened: Int
}

struct OverviewResponse: Codable {
    let filter: FilterLabel
    let sortBy: String
    let timeZone: String
    let hasData: Bool
    let totals: OverviewTotals
    let diversity: OverviewDiversity
    let span: OverviewSpan?
    let latestPlayAt: String?
    let latestPlayAtGlobal: String?
    let calendarDays: Int
    let avgMinPerDay: Int
    let avgStreamsPerDay: Int
    let metrics: [OverviewMetric]
    let topTracks: [TopTrackItem]
    let topArtists: [TopArtistItem]
    let topAlbums: [TopAlbumItem]
}

struct FilterLabel: Codable {
    let label: String
}

struct TopListResponse<T: Codable>: Codable {
    let filter: FilterLabel
    let sortBy: String
    let items: [T]
}

struct HistoryPoint: Codable, Identifiable {
    var id: String { label }
    let label: String
    let minutes: Int
    let streams: Int
}

struct HistoryResponse: Codable {
    let data: [HistoryPoint]
}

struct PatternsHourDay: Codable, Identifiable {
    var id: String { label }
    let label: String
    let minutes: Int
    let streams: Int
}

struct HeatmapCell: Codable {
    let day: Int
    let hour: Int
    let count: Int
}

struct HeatmapPayload: Codable {
    let grid: [HeatmapCell]
    let dayNames: [String]
}

struct PatternsResponse: Codable {
    let timeZone: String
    let byHour: [PatternsHourDay]
    let byDay: [PatternsHourDay]
    let heatmap: HeatmapPayload
}

struct TrackDetail: Codable {
    let trackName: String
    let artistName: String
    let albumName: String
    let albumArt: String?
    let streams: Int
    let minutesListened: Int
    let firstPlayedAt: Date?
    let lastPlayedAt: Date?
    let recentPlays: [RecentStream]
}

struct ArtistDetail: Codable {
    let artistName: String
    let artistArt: String?
    let streams: Int
    let minutesListened: Int
    let topTracks: [TopTrackItem]
    let topAlbums: [TopAlbumItem]
}

struct AlbumTrackRow: Identifiable, Codable {
    var id: String { trackName }
    let trackName: String
    let streams: Int
    let minutes: Int
}

struct AlbumDetail: Codable {
    let albumName: String
    let artistName: String
    let albumArt: String?
    let streams: Int
    let minutesListened: Int
    let tracks: [AlbumTrackRow]
}

struct RecentStream: Codable, Identifiable {
    let id: String
    let trackId: String?
    let trackName: String
    let artistName: String
    let albumName: String?
    let albumArt: String?
    let artistArt: String?
    let playedAt: String
    let isNowPlaying: Bool?
}

struct RecentResponse: Codable {
    let streams: [RecentStream]
    let checkedAt: String
}

struct FreshnessResponse: Codable {
    let latestPlayAt: String?
    let checkedAt: String
}

struct LastFmSyncResponse: Codable {
    let synced: Int?
    let skipped: Bool?
    let hasMore: Bool?
    let pending: Int?
    let message: String?
    let detail: String?
    let error: String?
    let streams: [SyncStreamPayload]?
}

struct LastFmSyncRequest: Encodable {
    let lastfmUsername: String
    let latestPlayedAt: String?
    let existing: [ExistingScrobblePayload]
}

struct ExistingScrobblePayload: Encodable {
    let artistName: String
    let trackName: String
    let playedAt: String
}

struct APIErrorResponse: Codable {
    let error: String?
    let detail: String?
}

struct ResolveArtistArtRequest: Encodable {
    let artists: [String]
}

struct ResolveAlbumArtQuery: Encodable {
    let key: String
    let artist: String
    let album: String
    let track: String
}

struct ResolveAlbumArtRequest: Encodable {
    let albums: [ResolveAlbumArtQuery]
}

struct ResolveTrackDurationQuery: Encodable {
    let artist: String
    let track: String
}

struct ResolveTrackDurationsRequest: Encodable {
    let tracks: [ResolveTrackDurationQuery]
}

struct ResolveArtResponse: Codable {
    let arts: [String: String?]?
    let error: String?
    let detail: String?
}

struct ResolveDurationsResponse: Codable {
    let durations: [String: Int]?
    let error: String?
    let detail: String?
}

enum TopSortMode: String, CaseIterable, Identifiable {
    case minutes
    case streams

    var id: String { rawValue }

    var label: String {
        switch self {
        case .minutes: "Minutes"
        case .streams: "Streams"
        }
    }
}

enum StatsPeriod: String, CaseIterable, Identifiable {
    case thirtyDays = "30d"
    case threeMonths = "3m"
    case sixMonths = "6m"
    case oneYear = "1y"
    case ytd
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .thirtyDays: "30 days"
        case .threeMonths: "3 months"
        case .sixMonths: "6 months"
        case .oneYear: "1 year"
        case .ytd: "This year"
        case .all: "All time"
        }
    }
}

enum ChartGroupBy: String, CaseIterable, Identifiable {
    case days
    case weeks
    case months

    var id: String { rawValue }

    var label: String {
        switch self {
        case .days: "Daily"
        case .weeks: "Weekly"
        case .months: "Monthly"
        }
    }

    var apiMode: String { rawValue }
}

enum ChartMetric: String, CaseIterable, Identifiable {
    case minutes
    case streams

    var id: String { rawValue }
}

enum AppAccent: String, CaseIterable, Identifiable {
    case spotify
    case blue
    case violet
    case sunset
    case rose
    case teal
    case mono

    var id: String { rawValue }

    var label: String {
        switch self {
        case .spotify: "Spotify"
        case .blue: "Ocean"
        case .violet: "Violet"
        case .sunset: "Sunset"
        case .rose: "Rose"
        case .teal: "Teal"
        case .mono: "Mono"
        }
    }

    var color: ColorAsset {
        switch self {
        case .spotify: .spotifyGreen
        case .blue: .blue
        case .violet: .violet
        case .sunset: .sunset
        case .rose: .rose
        case .teal: .teal
        case .mono: .mono
        }
    }
}

import SwiftUI

extension AppAccent {
    enum ColorAsset {
        case spotifyGreen, blue, violet, sunset, rose, teal, mono

        var swiftUIColor: Color {
            switch self {
            case .spotifyGreen: Color(red: 30 / 255, green: 215 / 255, blue: 96 / 255)
            case .blue: Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
            case .violet: Color(red: 139 / 255, green: 92 / 255, blue: 246 / 255)
            case .sunset: Color(red: 249 / 255, green: 115 / 255, blue: 22 / 255)
            case .rose: Color(red: 251 / 255, green: 113 / 255, blue: 133 / 255)
            case .teal: Color(red: 45 / 255, green: 212 / 255, blue: 191 / 255)
            case .mono: Color(red: 228 / 255, green: 228 / 255, blue: 231 / 255)
            }
        }
    }
}
