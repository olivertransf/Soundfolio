import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var preferences: StatsPreferences
    @State private var overview: OverviewResponse?
    @State private var recentPreview: [RecentStream] = []
    @State private var loading = true
    @State private var error: String?
    @State private var previewKind: TopListKind = .tracks

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var sectionSpacing: CGFloat { SoundfolioTheme.sectionSpacing(for: horizontalSizeClass) }

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                regularLayout
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: sectionSpacing) {
                        mainColumn
                    }
                    .soundfolioPage()
                }
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                SyncToolbarButton()
            }
        }
        .refreshable { await refresh() }
        .task(id: reloadID) { await load() }
        .onChange(of: appState.syncSavedCount) { _, _ in
            guard appState.isSyncing else { return }
            Task { await load() }
        }
    }

    private var regularLayout: some View {
        HStack(alignment: .top, spacing: 16) {
            ScrollView {
                VStack(alignment: .leading, spacing: sectionSpacing) {
                    mainColumn
                }
                .padding(.horizontal, SoundfolioTheme.pagePadding(for: horizontalSizeClass))
                .padding(.vertical, 12)
            }
            .frame(maxWidth: .infinity)

            recentColumn
                .frame(width: SoundfolioTheme.recentColumnWidth)
                .padding(.trailing, SoundfolioTheme.pagePadding(for: horizontalSizeClass))
                .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private var mainColumn: some View {
        FilterToolbar(preferences: preferences, context: .dashboard)

        if loading {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 160)
        } else if let error {
            errorView(error)
        } else if let overview, !overview.hasData {
            emptyView
        } else if let overview {
            statsGrid(overview)
            rankingsSection(overview)
            if horizontalSizeClass != .regular {
                recentListPanel(limit: 12)
            }
        }
    }

    private var recentColumn: some View {
        RankColumn(title: "Recent") {
            ScrollView {
                recentRows(limit: 40)
            }
        }
    }

    private func statsGrid(_ overview: OverviewResponse) -> some View {
        LazyVGrid(columns: SoundfolioTheme.metricColumns(for: horizontalSizeClass), spacing: 8) {
            StatCard(
                label: "Minutes",
                value: overview.totals.totalMinutes.formatted(),
                hint: "\(overview.totals.totalHours.formatted()) hours",
                accent: accent
            )
            StatCard(
                label: "Plays",
                value: overview.totals.totalStreams.formatted(),
                hint: overview.filter.label,
                accent: accent
            )
            StatCard(
                label: "Tracks",
                value: overview.diversity.uniqueTracks.formatted(),
                hint: "unique",
                accent: accent
            )
            StatCard(
                label: "Artists",
                value: overview.diversity.uniqueArtists.formatted(),
                hint: "unique",
                accent: accent
            )
            StatCard(
                label: "Min / day",
                value: overview.avgMinPerDay.formatted(),
                hint: "~\(overview.calendarDays) days",
                accent: accent
            )
            StatCard(
                label: "Plays / day",
                value: overview.avgStreamsPerDay.formatted(),
                accent: accent
            )
        }
    }

    @ViewBuilder
    private func rankingsSection(_ overview: OverviewResponse) -> some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: 12) {
                RankColumn(title: "Tracks") {
                    trackRows(overview.topTracks)
                }
                RankColumn(title: "Artists") {
                    artistRows(overview.topArtists)
                }
                RankColumn(title: "Albums") {
                    albumRows(overview.topAlbums)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                SoundfolioSegmentedControl(
                    title: nil,
                    options: TopListKind.allCases.map { ($0, $0.title) },
                    selection: $previewKind
                )
                RankColumn(title: previewKind.title) {
                    switch previewKind {
                    case .tracks: trackRows(overview.topTracks)
                    case .artists: artistRows(overview.topArtists)
                    case .albums: albumRows(overview.topAlbums)
                    }
                }
            }
        }
    }

    private func trackRows(_ items: [TopTrackItem]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(items.prefix(20).enumerated()), id: \.element.id) { index, track in
                RankedRow(
                    rank: index + 1,
                    title: track.trackName,
                    subtitle: track.artistName,
                    value: RankValueFormatter.primary(
                        minutes: track.minutesListened,
                        streams: track.streams,
                        sort: preferences.sort
                    ),
                    artworkURL: track.albumArt,
                    destination: TrackDetailView(
                        trackName: track.trackName,
                        artistName: track.artistName,
                        preferences: preferences
                    )
                )
            }
        }
    }

    private func artistRows(_ items: [TopArtistItem]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(items.prefix(20).enumerated()), id: \.element.id) { index, artist in
                RankedRow(
                    rank: index + 1,
                    title: artist.artistName,
                    subtitle: "",
                    value: RankValueFormatter.primary(
                        minutes: artist.minutesListened,
                        streams: artist.streams,
                        sort: preferences.sort
                    ),
                    artworkURL: artist.artistArt,
                    isCircleArt: true,
                    destination: ArtistDetailView(artistName: artist.artistName, preferences: preferences)
                )
            }
        }
    }

    private func albumRows(_ items: [TopAlbumItem]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(items.prefix(20).enumerated()), id: \.element.id) { index, album in
                RankedRow(
                    rank: index + 1,
                    title: album.albumName,
                    subtitle: album.artistName,
                    value: RankValueFormatter.primary(
                        minutes: album.minutesListened,
                        streams: album.streams,
                        sort: preferences.sort
                    ),
                    artworkURL: album.albumArt,
                    destination: AlbumDetailView(
                        albumName: album.albumName,
                        artistName: album.artistName,
                        preferences: preferences
                    )
                )
            }
        }
    }

    private func recentListPanel(limit: Int) -> some View {
        RankColumn(title: "Recent") {
            recentRows(limit: limit)
            Button("See all") { navigation.openLibrary(.recent) }
                .font(SoundfolioFont.semibold(12))
                .padding(.top, 8)
        }
    }

    private func recentRows(limit: Int) -> some View {
        Group {
            if recentPreview.isEmpty {
                Text("No recent plays yet.")
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
                    .padding(8)
            } else {
                let grouped = Dictionary(grouping: Array(recentPreview.prefix(limit))) { stream -> String in
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

                VStack(alignment: .leading, spacing: 0) {
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
        }
    }

    private func recentRow(_ stream: RecentStream) -> some View {
        let artSize = SoundfolioTheme.artworkSize(from: preferences)
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

    private var reloadID: String {
        let revisionKey = appState.isSyncing ? "syncing" : "\(streamStore.revision)"
        return "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(revisionKey)"
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Text("No data yet")
                .font(SoundfolioTheme.pageTitleFont)
            Text("Import history on the web, sync Last.fm, then pull to refresh.")
                .font(SoundfolioTheme.captionFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
                .multilineTextAlignment(.center)
            if let url = preferences.importURL {
                Link("Import on web", destination: url)
                    .font(SoundfolioFont.semibold(12))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 8) {
            Text(message)
                .font(SoundfolioTheme.rowSubtitleFont)
                .multilineTextAlignment(.center)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            Button("Retry") { Task { await load() } }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
    }

    private func load() async {
        if streamStore.streams.isEmpty {
            loading = streamStore.isLoading
            if loading { return }
        }
        loading = false
        error = nil
        let revision = streamStore.revision
        overview = statsCache.overview(streams: streamStore.streams, preferences: preferences, revision: revision)
        recentPreview = statsCache.recentStreams(
            from: streamStore.streams,
            limit: horizontalSizeClass == .regular ? 40 : 20,
            preferences: nil,
            revision: revision
        )
        appState.refreshFreshness(from: streamStore)
    }

    private func refresh() async {
        loading = false
        do {
            _ = try await appState.syncLastFm()
            await load()
        } catch {
            loading = false
            self.error = appState.handleError(error)
        }
    }
}
