import SwiftUI

struct RecentPlaysView: View {
    @Environment(AppState.self) private var appState
    @Bindable var preferences: StatsPreferences
    @State private var streams: [RecentStream] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading && streams.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, streams.isEmpty {
                VStack(spacing: 12) {
                    Text(error)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.bordered)
                }
                .padding()
            } else {
                List(streams) { stream in
                    recentRow(stream)
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Recent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                SyncStatusLabel(latestPlayAt: appState.latestPlayAt, isSyncing: appState.isSyncing)
            }
        }
        .refreshable { await refresh() }
        .task { await load() }
    }

    @ViewBuilder
    private func recentRow(_ stream: RecentStream) -> some View {
        HStack(spacing: 12) {
            ArtworkView(urlString: stream.albumArt, size: 48)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(stream.trackName)
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                    if stream.isNowPlaying == true {
                        Text("Now")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(SoundfolioTheme.accent(from: preferences))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(SoundfolioTheme.accent(from: preferences).opacity(0.15), in: Capsule())
                    }
                }
                Text(stream.artistName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if let date = parseISO8601(stream.playedAt) {
                Text(relativeTimestamp(date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        guard !preferences.baseURL.isEmpty else {
            loading = false
            error = APIClientError.missingBaseURL.localizedDescription
            return
        }
        loading = true
        error = nil
        appState.reloadClient()
        do {
            let response = try await appState.client.fetchRecent(
                limit: 100,
                timeZone: TimeZone.current.identifier
            )
            streams = response.streams
            await appState.refreshFreshness()
        } catch {
            self.error = appState.handleError(error)
        }
        loading = false
    }

    private func relativeTimestamp(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func refresh() async {
        do {
            _ = try await appState.syncLastFm()
            await load()
        } catch {
            self.error = appState.handleError(error)
        }
    }
}
