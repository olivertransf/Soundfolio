import SwiftUI

struct RecentPlaysView: View {
    @Environment(AppState.self) private var appState
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var preferences: StatsPreferences
    var embedInLibrary = false
    @State private var streams: [RecentStream] = []
    @State private var loading = true
    @State private var error: String?
    @State private var usesPeriodFilter = false

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
                Group {
                    if horizontalSizeClass == .regular {
                        ScrollView {
                            LazyVGrid(
                                columns: [
                                    GridItem(.adaptive(minimum: 320, maximum: 520), spacing: 12, alignment: .top)
                                ],
                                spacing: 12
                            ) {
                                ForEach(streams) { stream in
                                    NavigationLink {
                                        TrackDetailView(
                                            trackName: stream.trackName,
                                            artistName: stream.artistName,
                                            preferences: preferences
                                        )
                                    } label: {
                                        recentRow(stream)
                                            .padding(12)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .background(
                                                SoundfolioTheme.cardBackground,
                                                in: RoundedRectangle(cornerRadius: SoundfolioTheme.cardCornerRadius, style: .continuous)
                                            )
                                            .overlay {
                                                RoundedRectangle(cornerRadius: SoundfolioTheme.cardCornerRadius, style: .continuous)
                                                    .strokeBorder(Color.primary.opacity(0.06))
                                            }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .soundfolioPage()
                        }
                    } else {
                        List(streams) { stream in
                            NavigationLink {
                                TrackDetailView(
                                    trackName: stream.trackName,
                                    artistName: stream.artistName,
                                    preferences: preferences
                                )
                            } label: {
                                recentRow(stream)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if embedInLibrary {
                FilterToolbar(
                    preferences: preferences,
                    context: .recent,
                    recentUsesPeriodFilter: $usesPeriodFilter
                )
                .padding(.horizontal, SoundfolioTheme.pagePadding)
                .padding(.vertical, 8)
                .background(.bar)
            }
        }
        .navigationTitle(embedInLibrary ? "" : "Recent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                SyncToolbarButton()
            }
        }
        .refreshable { await refresh() }
        .task(id: reloadID) { await load() }
        .onChange(of: usesPeriodFilter) { _, _ in
            Task { await load() }
        }
    }

    private var reloadID: String {
        "\(usesPeriodFilter)-\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(streamStore.revision)"
    }

    @ViewBuilder
    private func recentRow(_ stream: RecentStream) -> some View {
        HStack(spacing: 12) {
            ArtworkView(urlString: stream.albumArt, size: 48)

            VStack(alignment: .leading, spacing: 3) {
                Text(stream.trackName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(stream.artistName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let date = parseISO8601(stream.playedAt) {
                    Text(absoluteTimestamp(date))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            .layoutPriority(1)

            Spacer(minLength: 8)

            if let date = parseISO8601(stream.playedAt) {
                Text(relativeTimestamp(date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        loading = true
        defer { loading = false }
        error = nil
        let revision = streamStore.revision
        if usesPeriodFilter {
            streams = statsCache.recentStreams(
                from: streamStore.streams,
                limit: 100,
                preferences: preferences,
                revision: revision
            )
        } else {
            streams = statsCache.recentStreams(
                from: streamStore.streams,
                limit: 100,
                preferences: nil,
                revision: revision
            )
        }
        appState.refreshFreshness(from: streamStore)
    }

    private func relativeTimestamp(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func absoluteTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
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
