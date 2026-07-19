import Foundation

struct MetadataBackfillProgress: Equatable {
    let message: String
}

struct MetadataBackfillResult: Equatable {
    let message: String
    let updatedStreams: Int
    let skipped: Bool
}

enum MetadataBackfill {
    private static let artBatchSize = 10
    private static let durationBatchSize = 40
    private static let fallbackDurationMs = 180_000

    @MainActor
    static func fixArtistArtwork(
        uid: String,
        client: APIClient,
        streamStore: StreamStore,
        onProgress: (MetadataBackfillProgress) -> Void
    ) async throws -> MetadataBackfillResult {
        SyncBackgroundSession.begin()
        defer { SyncBackgroundSession.end() }

        var missingByKey: [String: String] = [:]
        for stream in streamStore.streams {
            guard !ArtURL.isUsable(stream.artistArt) else { continue }
            let key = EntityNormalize.key(stream.artistName)
            guard !key.isEmpty, missingByKey[key] == nil else { continue }
            missingByKey[key] = stream.artistName
        }

        let list = Array(missingByKey.values)
        guard !list.isEmpty else {
            return MetadataBackfillResult(
                message: "Every loaded artist already has artwork.",
                updatedStreams: 0,
                skipped: true
            )
        }

        onProgress(.init(message: "Looking up \(list.count.formatted()) artists…"))
        var artByKey: [String: String] = [:]
        var foundArt = 0

        for start in stride(from: 0, to: list.count, by: artBatchSize) {
            SyncBackgroundSession.renew()
            let end = min(start + artBatchSize, list.count)
            let batch = Array(list[start ..< end])
            let response = try await client.resolveArtistArt(artists: batch)
            if let error = response.detail ?? response.error {
                throw APIClientError.server(error)
            }
            for (artistName, art) in response.arts ?? [:] {
                guard let art, ArtURL.isUsable(art) else { continue }
                artByKey[EntityNormalize.key(artistName)] = art
                foundArt += 1
            }
            onProgress(.init(message: "Checked \(end.formatted()) / \(list.count.formatted()) artists…"))
        }

        var patches: [(id: String, artistArt: String)] = []
        for stream in streamStore.streams {
            guard !ArtURL.isUsable(stream.artistArt) else { continue }
            guard let art = artByKey[EntityNormalize.key(stream.artistName)] else { continue }
            patches.append((stream.id, art))
        }

        onProgress(.init(message: "Saving artwork on \(patches.count.formatted()) plays…"))
        let updated = try await streamStore.patchArtistArt(uid: uid, updates: patches)

        let message: String
        if updated > 0 {
            message = "Updated \(updated.formatted()) plays (\(foundArt.formatted()) of \(list.count.formatted()) artists found)"
        } else if foundArt == 0 {
            message = "No artwork found for \(list.count.formatted()) artists"
        } else {
            message = "Artwork already up to date"
        }

        return MetadataBackfillResult(message: message, updatedStreams: updated, skipped: false)
    }

    @MainActor
    static func fixAlbumArtwork(
        uid: String,
        client: APIClient,
        streamStore: StreamStore,
        onProgress: (MetadataBackfillProgress) -> Void
    ) async throws -> MetadataBackfillResult {
        SyncBackgroundSession.begin()
        defer { SyncBackgroundSession.end() }

        var missingByKey: [String: ResolveAlbumArtQuery] = [:]
        for stream in streamStore.streams {
            guard !ArtURL.isUsable(stream.albumArt) else { continue }
            let key = albumArtKey(for: stream)
            guard !key.isEmpty, missingByKey[key] == nil else { continue }
            missingByKey[key] = ResolveAlbumArtQuery(
                key: key,
                artist: stream.artistName,
                album: stream.albumName,
                track: stream.trackName
            )
        }

        let list = Array(missingByKey.values)
        guard !list.isEmpty else {
            return MetadataBackfillResult(
                message: "Every loaded play already has album art.",
                updatedStreams: 0,
                skipped: true
            )
        }

        onProgress(.init(message: "Looking up \(list.count.formatted()) albums…"))
        var artByKey: [String: String] = [:]
        var foundArt = 0

        for start in stride(from: 0, to: list.count, by: artBatchSize) {
            SyncBackgroundSession.renew()
            let end = min(start + artBatchSize, list.count)
            let batch = Array(list[start ..< end])
            let response = try await client.resolveAlbumArt(albums: batch)
            if let error = response.detail ?? response.error {
                throw APIClientError.server(error)
            }
            for (key, art) in response.arts ?? [:] {
                guard let art, ArtURL.isUsable(art) else { continue }
                artByKey[key] = art
                foundArt += 1
            }
            onProgress(.init(message: "Checked \(end.formatted()) / \(list.count.formatted()) albums…"))
        }

        var patches: [(id: String, albumArt: String)] = []
        for stream in streamStore.streams {
            guard !ArtURL.isUsable(stream.albumArt) else { continue }
            guard let art = artByKey[albumArtKey(for: stream)] else { continue }
            patches.append((stream.id, art))
        }

        onProgress(.init(message: "Saving artwork on \(patches.count.formatted()) plays…"))
        let updated = try await streamStore.patchAlbumArt(uid: uid, updates: patches)

        let message: String
        if updated > 0 {
            message = "Updated \(updated.formatted()) plays (\(foundArt.formatted()) of \(list.count.formatted()) albums found)"
        } else if foundArt == 0 {
            message = "No artwork found for \(list.count.formatted()) albums"
        } else {
            message = "Artwork already up to date"
        }

        return MetadataBackfillResult(message: message, updatedStreams: updated, skipped: false)
    }

    @MainActor
    static func fixSongLengths(
        uid: String,
        client: APIClient,
        streamStore: StreamStore,
        onProgress: (MetadataBackfillProgress) -> Void
    ) async throws -> MetadataBackfillResult {
        SyncBackgroundSession.begin()
        defer { SyncBackgroundSession.end() }

        let lastFmRows = streamStore.streams.filter { $0.trackId.hasPrefix("lfm-") }
        guard !lastFmRows.isEmpty else {
            return MetadataBackfillResult(
                message: "No Last.fm plays loaded.",
                updatedStreams: 0,
                skipped: true
            )
        }

        var unique: [String: ResolveTrackDurationQuery] = [:]
        for row in lastFmRows {
            let artist = EntityNormalize.label(row.artistName)
            let track = EntityNormalize.label(row.trackName)
            let key = "\(artist)\0\(track)"
            if unique[key] == nil {
                unique[key] = ResolveTrackDurationQuery(artist: artist, track: track)
            }
        }

        let list = Array(unique.values)
        onProgress(.init(message: "Resolving \(list.count.formatted()) tracks…"))
        var durationByKey: [String: Int] = [:]

        for start in stride(from: 0, to: list.count, by: durationBatchSize) {
            SyncBackgroundSession.renew()
            let end = min(start + durationBatchSize, list.count)
            let batch = Array(list[start ..< end])
            let response = try await client.resolveTrackDurations(tracks: batch)
            if let error = response.detail ?? response.error {
                throw APIClientError.server(error)
            }
            for (key, ms) in response.durations ?? [:] {
                durationByKey[key] = ms
            }
            onProgress(.init(message: "Resolved \(end.formatted()) / \(list.count.formatted()) tracks…"))
        }

        var patches: [(id: String, durationMs: Int)] = []
        for stream in streamStore.streams where stream.trackId.hasPrefix("lfm-") {
            let key = "\(EntityNormalize.label(stream.artistName))\0\(EntityNormalize.label(stream.trackName))"
            let durationMs = durationByKey[key] ?? fallbackDurationMs
            guard stream.durationMs != durationMs else { continue }
            patches.append((stream.id, durationMs))
        }

        onProgress(.init(message: "Saving \(patches.count.formatted()) plays…"))
        let updated = try await streamStore.patchDurations(uid: uid, updates: patches)

        let message: String
        if updated > 0 {
            message = "Updated \(updated.formatted()) plays across \(list.count.formatted()) tracks"
        } else {
            message = "Lengths already correct (\(list.count.formatted()) tracks)"
        }

        return MetadataBackfillResult(message: message, updatedStreams: updated, skipped: false)
    }

    private static func albumArtKey(for stream: StreamRecord) -> String {
        if !stream.albumName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return EntityNormalize.albumGroupKey(albumName: stream.albumName, artistName: stream.artistName)
        }
        return "track:\(EntityNormalize.key(stream.trackName))\0\(EntityNormalize.key(stream.artistName))"
    }
}
