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

    init(preferences: StatsPreferences) {
        self.preferences = preferences
        client = APIClient(baseURLString: preferences.baseURL)
    }

    func reloadClient() {
        client.updateConfiguration(baseURLString: preferences.baseURL)
    }

    func syncLastFm() async throws -> LastFmSyncResponse {
        isSyncing = true
        defer { isSyncing = false }
        reloadClient()

        var totalSynced = 0
        var lastResult: LastFmSyncResponse?

        for _ in 0 ..< 40 {
            let result = try await client.syncLastFm(timeZone: TimeZone.current.identifier)
            lastResult = result
            if let error = result.error ?? result.detail {
                lastSyncMessage = error
                throw APIClientError.server(error)
            }
            if result.skipped == true {
                lastSyncMessage = result.detail ?? result.message ?? "Last.fm sync is not configured on the server."
                await refreshFreshness()
                return result
            }
            let synced = result.synced ?? 0
            totalSynced += synced
            if result.hasMore != true || synced == 0 {
                break
            }
        }

        guard let lastResult else {
            throw APIClientError.server("Sync did not return a response.")
        }

        if totalSynced > 0 {
            lastSyncMessage = "Added \(totalSynced) scrobbles"
        } else {
            lastSyncMessage = lastResult.message ?? "No new scrobbles"
        }

        await refreshFreshness()
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        return lastResult
    }

    func refreshFreshness() async {
        reloadClient()
        guard !preferences.baseURL.isEmpty else { return }
        do {
            let freshness = try await client.fetchFreshness()
            freshnessCheckedAt = parseISO8601(freshness.checkedAt)
            if let raw = freshness.latestPlayAt {
                latestPlayAt = parseISO8601(raw)
            }
        } catch {
            // Non-fatal for toolbar status
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