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
            "Access key was rejected. Check Settings."
        case .server(let message):
            message
        case .decoding(let error):
            "Could not read server response: \(error.localizedDescription)"
        }
    }
}

struct StatsQuery {
    var range: StatsPeriod = .ytd
    var customFrom: String?
    var customTo: String?
    var sort: TopSortMode = .minutes
    var timeZone: String = TimeZone.current.identifier

    func apply(to items: inout [URLQueryItem]) {
        if let customFrom, let customTo {
            items.append(URLQueryItem(name: "from", value: customFrom))
            items.append(URLQueryItem(name: "to", value: customTo))
        } else {
            items.append(URLQueryItem(name: "range", value: range.rawValue))
        }
        items.append(URLQueryItem(name: "sort", value: sort.rawValue))
        items.append(URLQueryItem(name: "tz", value: timeZone))
    }
}

@MainActor
final class APIClient {
    private let session: URLSession
    private var baseURLString: String

    init(baseURLString: String = "") {
        self.baseURLString = baseURLString
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        session = URLSession(configuration: config)
    }

    func updateConfiguration(baseURLString: String) {
        self.baseURLString = baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func fetchOverview(query: StatsQuery) async throws -> OverviewResponse {
        try await get("/api/stats/overview", query: query)
    }

    func fetchTopTracks(query: StatsQuery, limit: Int = 50) async throws -> TopListResponse<TopTrackItem> {
        try await get("/api/stats/top-tracks", query: query, extra: [URLQueryItem(name: "limit", value: "\(limit)")])
    }

    func fetchTopArtists(query: StatsQuery, limit: Int = 50) async throws -> TopListResponse<TopArtistItem> {
        try await get("/api/stats/top-artists", query: query, extra: [URLQueryItem(name: "limit", value: "\(limit)")])
    }

    func fetchTopAlbums(query: StatsQuery, limit: Int = 50) async throws -> TopListResponse<TopAlbumItem> {
        try await get("/api/stats/top-albums", query: query, extra: [URLQueryItem(name: "limit", value: "\(limit)")])
    }

    func fetchHistory(query: StatsQuery, mode: ChartGroupBy) async throws -> HistoryResponse {
        try await get(
            "/api/stats/history",
            query: query,
            extra: [URLQueryItem(name: "mode", value: mode.apiMode)]
        )
    }

    func fetchPatterns(query: StatsQuery) async throws -> PatternsResponse {
        try await get("/api/stats/patterns", query: query)
    }

    func fetchRecent(limit: Int = 100, timeZone: String) async throws -> RecentResponse {
        try await get(
            "/api/stats/recent",
            extra: [
                URLQueryItem(name: "limit", value: "\(limit)"),
                URLQueryItem(name: "tz", value: timeZone),
            ]
        )
    }

    func fetchFreshness() async throws -> FreshnessResponse {
        try await get("/api/stats/freshness")
    }

    func syncLastFm() async throws -> LastFmSyncResponse {
        try await post("/api/sync-lastfm")
    }

    private func get<T: Decodable>(
        _ path: String,
        query: StatsQuery? = nil,
        extra: [URLQueryItem] = []
    ) async throws -> T {
        let request = try buildRequest(path: path, method: "GET", query: query, extra: extra)
        return try await perform(request)
    }

    private func post<T: Decodable>(_ path: String) async throws -> T {
        let request = try buildRequest(path: path, method: "POST")
        return try await perform(request)
    }

    private func buildRequest(
        path: String,
        method: String,
        query: StatsQuery? = nil,
        extra: [URLQueryItem] = []
    ) throws -> URLRequest {
        guard !baseURLString.isEmpty else { throw APIClientError.missingBaseURL }
        var normalized = baseURLString
        if !normalized.hasPrefix("http") {
            normalized = "https://\(normalized)"
        }
        while normalized.hasSuffix("/") { normalized.removeLast() }

        guard var components = URLComponents(string: normalized + path) else {
            throw APIClientError.invalidURL
        }
        var queryItems = extra
        if let query {
            query.apply(to: &queryItems)
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else { throw APIClientError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
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
            throw APIClientError.server("Request failed (\(http.statusCode)).")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIClientError.decoding(error)
        }
    }
}

