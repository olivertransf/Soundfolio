import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
import FirebaseAuth
#endif

@MainActor
@Observable
final class AppState {
    let preferences: StatsPreferences
    private(set) var client: APIClient

    var lastSyncMessage: String?
    var lastSyncedAt: Date?
    var isSyncing = false
    var syncProgressMessage: String?
    var syncSavedCount = 0
    var syncPendingCount = 0
    var lastSyncResult: SyncResult?
    var isSyncingInBackground = false
    var globalError: String?

    struct SyncResult: Equatable {
        enum Kind: Equatable {
            case added
            case upToDate
            case skipped
            case failed
        }

        let kind: Kind
        let message: String
        let addedCount: Int
        let date: Date
    }

    var latestPlayAt: Date?
    var freshnessCheckedAt: Date?

    private weak var streamStore: StreamStore?
    private weak var authManager: AuthManager?

    init(preferences: StatsPreferences) {
        self.preferences = preferences
        client = APIClient(baseURLString: StatsPreferences.defaultBaseURL)
    }

    func bindAuth(_ authManager: AuthManager) {
        self.authManager = authManager
        client.authTokenProvider = { [weak authManager] in
            try await authManager?.idToken()
        }
    }

    func bindStreamStore(_ streamStore: StreamStore) {
        self.streamStore = streamStore
    }

    func reloadClient() {
        client.updateConfiguration(baseURLString: StatsPreferences.defaultBaseURL)
    }

    /// Pull latest plays from Firestore only (no Last.fm network sync).
    func refreshFromDatabase() async throws {
        guard let streamStore else {
            throw APIClientError.unauthorized
        }
        try await streamStore.reloadFromServer()
        refreshFreshness(from: streamStore)
    }

    /// Refresh library from Firestore, then pull new scrobbles from Last.fm.
    func syncLastFm() async throws -> LastFmSyncResponse {
        guard let authManager, let streamStore, let uid = authManager.user?.uid else {
            throw APIClientError.unauthorized
        }
        guard let lastfmUsername = authManager.lastfmUsername, !lastfmUsername.isEmpty else {
            throw APIClientError.server("Add your Last.fm username in onboarding.")
        }

        isSyncing = true
        syncSavedCount = 0
        syncPendingCount = 0
        applySyncProgress("Refreshing library…")
        lastSyncResult = nil
        SyncBackgroundSession.begin()
        defer {
            isSyncing = false
            syncProgressMessage = nil
            syncSavedCount = 0
            syncPendingCount = 0
            isSyncingInBackground = false
            SyncBackgroundSession.end()
        }
        reloadClient()

        do {
            try await streamStore.reloadFromServer()
            refreshFreshness(from: streamStore)
        } catch {
            if !Self.isCancellation(error) { throw error }
        }

        var totalWritten = 0
        var lastResult: LastFmSyncResponse?
        var batch = 0

        do {
        for _ in 0 ..< 40 {
            SyncBackgroundSession.renew()
            applySyncProgress(
                batch == 0
                    ? "Fetching scrobbles from Last.fm…"
                    : "Importing scrobbles (\(totalWritten) saved)…"
            )
            let result = try await client.syncLastFm(
                lastfmUsername: lastfmUsername,
                streams: streamStore.streams,
                timeZone: TimeZone.current.identifier
            )
            lastResult = result
            batch += 1
            if let error = result.error ?? result.detail, result.skipped != true {
                let message = error
                lastSyncMessage = message
                lastSyncResult = SyncResult(kind: .failed, message: message, addedCount: totalWritten, date: Date())
                throw APIClientError.server(error)
            }
            if result.skipped == true {
                let message = result.detail ?? result.message ?? "Last.fm sync is not configured on the server."
                lastSyncMessage = message
                lastSyncResult = SyncResult(kind: .skipped, message: message, addedCount: 0, date: Date())
                refreshFreshness(from: streamStore)
                return result
            }

            let payloads = result.streams ?? []
            if payloads.isEmpty { break }

            applySyncProgress("Saving \(payloads.count) scrobbles…")
            let written = try await streamStore.writeStreams(uid: uid, payloads: payloads, skipExisting: false)
            totalWritten += written
            syncSavedCount = totalWritten

            if let pending = result.pending, pending > 0, result.hasMore == true {
                syncPendingCount = pending
                applySyncProgress("Saved \(totalWritten) · \(pending) remaining")
            } else {
                syncPendingCount = 0
                if written > 0 {
                    applySyncProgress("Saved \(totalWritten) scrobbles")
                }
            }

            if result.hasMore != true || written == 0 {
                break
            }
        }

        guard let lastResult else {
            let message = "Sync did not return a response."
            lastSyncResult = SyncResult(kind: .failed, message: message, addedCount: totalWritten, date: Date())
            throw APIClientError.server(message)
        }

        let message: String
        let kind: SyncResult.Kind
        if totalWritten > 0 {
            message = "Added \(totalWritten) scrobbles"
            kind = .added
        } else {
            message = lastResult.message ?? "Already up to date"
            kind = .upToDate
        }
        lastSyncMessage = message
        lastSyncedAt = Date()
        lastSyncResult = SyncResult(kind: kind, message: message, addedCount: totalWritten, date: Date())

        refreshFreshness(from: streamStore)
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        return lastResult
        } catch {
            if lastSyncResult == nil {
                let message = handleError(error)
                lastSyncMessage = message
                lastSyncResult = SyncResult(kind: .failed, message: message, addedCount: totalWritten, date: Date())
            }
            throw error
        }
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

    static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return true }
        let message = ns.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return message == "cancelled" || message == "canceled"
    }

    func setSyncBackgrounded(_ backgrounded: Bool) {
        isSyncingInBackground = backgrounded && isSyncing
        guard isSyncing, let current = syncProgressMessage else { return }
        if backgrounded {
            if !current.hasPrefix("Background sync · ") {
                syncProgressMessage = "Background sync · \(current)"
            }
        } else if current.hasPrefix("Background sync · ") {
            syncProgressMessage = String(current.dropFirst("Background sync · ".count))
        }
    }

    private func applySyncProgress(_ message: String) {
        syncProgressMessage = isSyncingInBackground ? "Background sync · \(message)" : message
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
