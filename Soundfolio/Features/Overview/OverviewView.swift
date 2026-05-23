import SwiftUI

struct OverviewView: View {
    @Environment(AppState.self) private var appState
    @Bindable var preferences: StatsPreferences
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var overview: OverviewResponse?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                StatsFiltersBar(preferences: preferences)

                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                } else if let error {
                    errorView(error)
                } else if let overview, !overview.hasData {
                    emptyView
                } else if let overview {
                    summaryHeader(overview)
                    MetricsGrid(metrics: overview.metrics)
                    ListeningChartSection(preferences: preferences)
                    topPreviews(overview)
                }
            }
            .soundfolioPage()
        }
        .navigationTitle("Soundfolio")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                SyncStatusLabel(latestPlayAt: appState.latestPlayAt, isSyncing: appState.isSyncing)
            }
        }
        .refreshable { await refresh() }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(preferences.baseURL)"
    }

    @ViewBuilder
    private func summaryHeader(_ overview: OverviewResponse) -> some View {
        HStack(alignment: .center, spacing: 8) {
            Text(overview.filter.label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(SoundfolioTheme.accent(from: preferences))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(SoundfolioTheme.accent(from: preferences).opacity(0.15), in: Capsule())

            if let latest = overview.latestPlayAt, let date = parseISO8601(latest) {
                Text(relativeTimestamp(date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
    }

    private func relativeTimestamp(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return "Last play " + formatter.localizedString(for: date, relativeTo: Date())
    }

    @ViewBuilder
    private func topPreviews(_ overview: OverviewResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Top 5")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            if horizontalSizeClass == .regular {
                HStack(alignment: .top, spacing: 8) {
                    topPreviewColumn(
                        title: "Tracks",
                        rows: overview.topTracks.enumerated().map {
                            ($0.offset, $0.element.trackName, $0.element.artistName,
                             rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                             $0.element.albumArt, false)
                        }
                    )
                    topPreviewColumn(
                        title: "Artists",
                        rows: overview.topArtists.enumerated().map {
                            ($0.offset, $0.element.artistName,
                             preferences.sort == .streams ? "\($0.element.minutesListened)m" : "\($0.element.streams)p",
                             rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                             $0.element.artistArt, true)
                        }
                    )
                    topPreviewColumn(
                        title: "Albums",
                        rows: overview.topAlbums.enumerated().map {
                            ($0.offset, $0.element.albumName, $0.element.artistName,
                             rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                             $0.element.albumArt, false)
                        }
                    )
                }
            } else {
                topPreviewColumn(
                    title: "Tracks",
                    rows: overview.topTracks.enumerated().map {
                        ($0.offset, $0.element.trackName, $0.element.artistName,
                         rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                         $0.element.albumArt, false)
                    }
                )
                topPreviewColumn(
                    title: "Artists",
                    rows: overview.topArtists.enumerated().map {
                        ($0.offset, $0.element.artistName,
                         preferences.sort == .streams ? "\($0.element.minutesListened)m" : "\($0.element.streams)p",
                         rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                         $0.element.artistArt, true)
                    }
                )
                topPreviewColumn(
                    title: "Albums",
                    rows: overview.topAlbums.enumerated().map {
                        ($0.offset, $0.element.albumName, $0.element.artistName,
                         rankValue(minutes: $0.element.minutesListened, streams: $0.element.streams),
                         $0.element.albumArt, false)
                    }
                )
            }
        }
    }

    private func topPreviewColumn(
        title: String,
        rows: [(Int, String, String, String, String?, Bool)]
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    RankedRow(
                        rank: row.0 + 1,
                        title: row.1,
                        subtitle: row.2,
                        value: row.3,
                        artworkURL: row.4,
                        isCircleArt: row.5
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .soundfolioCard()
    }

    private func rankValue(minutes: Int, streams: Int) -> String {
        preferences.sort == .streams
            ? "\(streams.formatted())×"
            : "\(minutes.formatted())m"
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .font(.title)
                .foregroundStyle(SoundfolioTheme.accent(from: preferences))
            Text("No data yet")
                .font(.headline)
            Text("Import history on the web, then pull to refresh.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let url = preferences.importURL {
                Link("Import", destination: url)
                    .font(.caption.weight(.semibold))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 8) {
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Retry") { Task { await load() } }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
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
            overview = try await appState.client.fetchOverview(query: preferences.makeQuery())
            await appState.refreshFreshness()
        } catch {
            self.error = appState.handleError(error)
        }
        loading = false
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
