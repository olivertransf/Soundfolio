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
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                if embedInLibrary {
                    FilterToolbar(
                        preferences: preferences,
                        context: .recent,
                        recentUsesPeriodFilter: $usesPeriodFilter
                    )
                }

                if loading && streams.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                } else if let error, streams.isEmpty {
                    VStack(spacing: 12) {
                        Text(error)
                            .font(SoundfolioTheme.rowSubtitleFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                            .multilineTextAlignment(.center)
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120)
                } else {
                    RankColumn(title: "Recent") {
                        recentGroupedList
                    }
                }
            }
            .soundfolioPage()
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

    private var recentGroupedList: some View {
        let grouped = Dictionary(grouping: streams) { stream -> String in
            guard let date = parseISO8601(stream.playedAt) else { return "Unknown" }
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
        let days = grouped.keys.sorted { lhs, rhs in
            guard
                let left = grouped[lhs]?.first.flatMap({ parseISO8601($0.playedAt) }),
                let right = grouped[rhs]?.first.flatMap({ parseISO8601($0.playedAt) })
            else { return lhs > rhs }
            return left > right
        }

        return VStack(alignment: .leading, spacing: 0) {
            ForEach(days, id: \.self) { day in
                Text(day.uppercased())
                    .font(SoundfolioFont.semibold(10))
                    .tracking(0.6)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                    .padding(.horizontal, 6)
                    .padding(.top, 10)
                    .padding(.bottom, 4)

                ForEach(grouped[day] ?? []) { stream in
                    NavigationLink {
                        TrackDetailView(
                            trackName: stream.trackName,
                            artistName: stream.artistName,
                            preferences: preferences
                        )
                    } label: {
                        recentRow(stream)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func recentRow(_ stream: RecentStream) -> some View {
        let artSize = SoundfolioTheme.artworkSize(from: preferences, list: false)
        return HStack(spacing: 10) {
            if artSize > 0 {
                ArtworkView(urlString: stream.albumArt, size: artSize)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(stream.trackName)
                    .font(SoundfolioTheme.rowTitleFont)
                    .lineLimit(1)
                Text(stream.artistName)
                    .font(SoundfolioTheme.rowSubtitleFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let date = parseISO8601(stream.playedAt) {
                Text(formatPlayTime(date, preference: preferences.timeDisplay))
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, SoundfolioTheme.rowVerticalPadding(from: preferences))
        .contentShape(Rectangle())
    }

    private func load() async {
        loading = true
        defer { loading = false }
        error = nil
        streams = statsCache.recentStreams(
            from: streamStore.streams,
            limit: 200,
            preferences: usesPeriodFilter ? preferences : nil,
            revision: streamStore.revision
        )
    }

    private func refresh() async {
        do {
            try await appState.refreshFromDatabase()
            await load()
        } catch {
            if AppState.isCancellation(error) { return }
            self.error = appState.handleError(error)
        }
    }
}
