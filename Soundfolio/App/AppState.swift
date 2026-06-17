import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

@MainActor
@Observable
final class AppState {
    let preferences: StatsPreferences
    private(set) var client: APIClient

    var lastSyncMessage: String?
    var isSyncing = false
    var globalError: String?

    var latestPlayAt: Date?
    var freshnessCheckedAt: Date?

    private weak var streamStore: StreamStore?
    private weak var authManager: AuthManager?

    init(preferences: StatsPreferences) {
        self.preferences = preferences
        client = APIClient(baseURLString: preferences.baseURL)
    }

    func bindAuth(_ authManager: AuthManager) {
        self.authManager = authManager
        client.authTokenProvider = { [weak authManager] in
            try await authManager?.idToken()
        }
        authManager.updateBaseURL(preferences.baseURL)
    }

    func bindStreamStore(_ streamStore: StreamStore) {
        self.streamStore = streamStore
    }

    func reloadClient() {
        client.updateConfiguration(baseURLString: preferences.baseURL)
    }

    func syncLastFm() async throws -> LastFmSyncResponse {
        guard let authManager, let streamStore, let uid = authManager.user?.uid else {
            throw APIClientError.unauthorized
        }
        guard let lastfmUsername = authManager.lastfmUsername, !lastfmUsername.isEmpty else {
            throw APIClientError.server("Add your Last.fm username in onboarding.")
        }

        isSyncing = true
        defer { isSyncing = false }
        reloadClient()

        var totalWritten = 0
        var lastResult: LastFmSyncResponse?

        for _ in 0 ..< 40 {
            let result = try await client.syncLastFm(
                lastfmUsername: lastfmUsername,
                streams: streamStore.streams,
                timeZone: TimeZone.current.identifier
            )
            lastResult = result
            if let error = result.error ?? result.detail {
                lastSyncMessage = error
                throw APIClientError.server(error)
            }
            if result.skipped == true {
                lastSyncMessage = result.detail ?? result.message ?? "Last.fm sync is not configured on the server."
                refreshFreshness(from: streamStore)
                return result
            }

            let payloads = result.streams ?? []
            if payloads.isEmpty { break }

            let written = try await streamStore.writeStreams(uid: uid, payloads: payloads, skipExisting: true)
            totalWritten += written

            if result.hasMore != true || written == 0 {
                break
            }
        }

        guard let lastResult else {
            throw APIClientError.server("Sync did not return a response.")
        }

        if totalWritten > 0 {
            lastSyncMessage = "Added \(totalWritten) scrobbles"
        } else {
            lastSyncMessage = lastResult.message ?? "No new scrobbles"
        }

        refreshFreshness(from: streamStore)
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        return lastResult
    }

    func refreshFreshness(from streamStore: StreamStore? = nil) {
        freshnessCheckedAt = Date()
        if let store = streamStore ?? self.streamStore {
            latestPlayAt = store.latestPlayAt
        }
    }

    func handleError(_ error: Error) -> String {
        if let api = error as? APIClientError {
            return api.localizedDescription
        }
        return error.localizedDescription
    }
}

func parseISO8601(_ string: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: string) { return date }
    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    return plain.date(from: string)
}
