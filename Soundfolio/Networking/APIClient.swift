import Foundation

enum APIClientError: LocalizedError {
    case missingBaseURL
    case invalidURL
    case unauthorized
    case server(String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .missingBaseURL:
            "Add your Soundfolio server URL in Settings."
        case .invalidURL:
            "Server URL is invalid."
        case .unauthorized:
            "Sign in expired or was rejected. Sign in again."
        case .server(let message):
            message
        case .decoding(let error):
            "Could not read server response: \(error.localizedDescription)"
        }
    }
}

@MainActor
final class APIClient {
    private let session: URLSession
    private var baseURLString: String
    var authTokenProvider: (@MainActor () async throws -> String?)?

    init(baseURLString: String = StatsPreferences.defaultBaseURL) {
        self.baseURLString = baseURLString
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        session = URLSession(configuration: config)
    }

    func updateConfiguration(baseURLString: String) {
        self.baseURLString = baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static let syncExistingCap = 2_500
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    func syncLastFm(
        lastfmUsername: String,
        streams: [StreamRecord],
        timeZone: String = TimeZone.current.identifier
    ) async throws -> LastFmSyncResponse {
        let latestPlayedAt = streams.first.map { Self.isoFormatter.string(from: $0.playedAt) }
        let existing = streams.prefix(Self.syncExistingCap).map {
            ExistingScrobblePayload(
                artistName: $0.artistName,
                trackName: $0.trackName,
                playedAt: Self.isoFormatter.string(from: $0.playedAt)
            )
        }
        let body = LastFmSyncRequest(
            lastfmUsername: lastfmUsername,
            latestPlayedAt: latestPlayedAt,
            existing: existing
        )
        return try await post(
            "/api/sync-lastfm",
            body: body,
            extra: [URLQueryItem(name: "tz", value: timeZone)]
        )
    }

    func resolveArtistArt(artists: [String]) async throws -> ResolveArtResponse {
        try await post("/api/resolve-artist-art", body: ResolveArtistArtRequest(artists: artists))
    }

    func resolveAlbumArt(albums: [ResolveAlbumArtQuery]) async throws -> ResolveArtResponse {
        try await post("/api/resolve-album-art", body: ResolveAlbumArtRequest(albums: albums))
    }

    func resolveTrackDurations(tracks: [ResolveTrackDurationQuery]) async throws -> ResolveDurationsResponse {
        try await post("/api/resolve-track-durations", body: ResolveTrackDurationsRequest(tracks: tracks))
    }

    private func post<T: Decodable, Body: Encodable>(
        _ path: String,
        body: Body,
        extra: [URLQueryItem] = []
    ) async throws -> T {
        var request = try await buildRequest(path: path, method: "POST", extra: extra)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    private func buildRequest(
        path: String,
        method: String,
        extra: [URLQueryItem] = []
    ) async throws -> URLRequest {
        var components = try normalizedBaseComponents()
        components.path = path
        if !extra.isEmpty {
            components.queryItems = extra
        }
        guard let url = components.url else { throw APIClientError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = try await authTokenProvider?() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func normalizedBaseComponents() throws -> URLComponents {
        var normalized = baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.isEmpty {
            normalized = StatsPreferences.defaultBaseURL
        }
        if !normalized.hasPrefix("http") {
            normalized = "https://\(normalized)"
        }
        guard var components = URLComponents(string: normalized), components.host?.isEmpty == false else {
            throw APIClientError.invalidURL
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.server("No response from server.")
        }
        if http.statusCode == 401 {
            throw APIClientError.unauthorized
        }
        guard (200 ... 299).contains(http.statusCode) else {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIClientError.server(apiError.detail ?? apiError.error ?? "Request failed (\(http.statusCode)).")
            }
            if http.statusCode == 404 {
                throw APIClientError.server("Sync endpoint was not found on the server.")
            }
            throw APIClientError.server("Request failed (\(http.statusCode)).")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIClientError.decoding(error)
        }
    }
}
