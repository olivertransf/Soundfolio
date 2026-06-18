import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(AppNavigation.self) private var navigation
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var preferences: StatsPreferences
    @State private var overview: OverviewResponse?
    @State private var patterns: PatternsResponse?
    @State private var recentPreview: [RecentStream] = []
    @State private var loading = true
    @State private var error: String?
    @State private var previewKind: TopListKind = .tracks

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var sectionSpacing: CGFloat { SoundfolioTheme.sectionSpacing(for: horizontalSizeClass) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .dashboard)

                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                } else if let error {
                    errorView(error)
                } else if let overview, !overview.hasData {
                    emptyView
                } else if let overview {
                    dashboardContent(overview)
                }
            }
            .soundfolioPage()
        }
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .large : .inline)
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

    private var reloadID: String {
        let revisionKey = appState.isSyncing ? "syncing" : "\(streamStore.revision)"
        return "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(revisionKey)"
    }

    @ViewBuilder
    private func dashboardContent(_ overview: OverviewResponse) -> some View {
        if horizontalSizeClass == .regular {
            regularDashboard(overview)
        } else {
            compactDashboard(overview)
        }
    }

    private func regularDashboard(_ overview: OverviewResponse) -> some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: sectionSpacing) {
                heroOverviewCard(overview)
                ListeningChartSection(preferences: preferences)
                rankingsPreviewSection(overview)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)

            VStack(alignment: .leading, spacing: sectionSpacing) {
                insightPanel
                recentPreviewSection
            }
            .frame(width: 380, alignment: .topLeading)
        }
    }

    @ViewBuilder
    private func compactDashboard(_ overview: OverviewResponse) -> some View {
        summaryStrip(overview)
        heroStats(overview)
        insightRow
        ListeningChartSection(preferences: preferences)
        recentPreviewSection
        rankingsPreviewSection(overview)
    }

    @ViewBuilder
    private func heroOverviewCard(_ overview: OverviewResponse) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your listening at a glance")
                        .font(.title2.weight(.bold))
                    Text(heroSubtitle(for: overview))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 12)

                Text(overview.filter.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(accent.opacity(0.14), in: Capsule())
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                metricTile(
                    label: "Minutes",
                    value: overview.totals.totalMinutes.formatted(),
                    detail: "\(overview.totals.totalHours.formatted()) hours",
                    systemImage: "clock.fill"
                )
                metricTile(
                    label: "Plays",
                    value: overview.totals.totalStreams.formatted(),
                    detail: "\(overview.avgStreamsPerDay.formatted()) / day",
                    systemImage: "play.fill"
                )
                metricTile(
                    label: "Daily pace",
                    value: "\(overview.avgMinPerDay.formatted()) min",
                    detail: "~\(overview.calendarDays) days",
                    systemImage: "calendar"
                )
                metricTile(
                    label: "Tracks",
                    value: overview.diversity.uniqueTracks.formatted(),
                    detail: "unique",
                    systemImage: "music.note"
                )
                metricTile(
                    label: "Artists",
                    value: overview.diversity.uniqueArtists.formatted(),
                    detail: "unique",
                    systemImage: "person.fill"
                )
                metricTile(
                    label: "Ranked albums",
                    value: overview.topAlbums.count.formatted(),
                    detail: "shown",
                    systemImage: "square.stack.fill"
                )
            }
        }
        .soundfolioCard()
    }

    private func metricTile(label: String, value: String, detail: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent)
                .frame(width: 30, height: 30)
                .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .padding(12)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func heroSubtitle(for overview: OverviewResponse) -> String {
        if let span = overview.span, let spanLabel = formatSpanLabel(span) {
            return spanLabel
        }
        if let latest = overview.latestPlayAt, let date = parseISO8601(latest) {
            return "Latest play \(relativeTimestamp(date))"
        }
        return "A cleaner summary of your current listening period."
    }

    @ViewBuilder
    private func summaryStrip(_ overview: OverviewResponse) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(overview.filter.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(accent.opacity(0.15), in: Capsule())

                if let span = overview.span, let spanLabel = formatSpanLabel(span) {
                    Text(spanLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            if let latest = overview.latestPlayAt, let date = parseISO8601(latest) {
                Text("Latest in period: " + relativeTimestamp(date))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func heroStats(_ overview: OverviewResponse) -> some View {
        if horizontalSizeClass == .regular {
            LazyVGrid(columns: SoundfolioTheme.heroColumns(for: horizontalSizeClass), spacing: 12) {
                StatCard(
                    label: "Minutes",
                    value: overview.totals.totalMinutes.formatted(),
                    hint: "\(overview.totals.totalHours.formatted()) hours",
                    systemImage: "clock.fill",
                    style: .hero,
                    accent: accent
                )
                StatCard(
                    label: "Plays",
                    value: overview.totals.totalStreams.formatted(),
                    hint: overview.filter.label,
                    systemImage: "play.fill",
                    style: .hero,
                    accent: accent
                )
                StatCard(
                    label: "Tracks",
                    value: overview.diversity.uniqueTracks.formatted(),
                    hint: "unique",
                    systemImage: "music.note",
                    accent: accent
                )
                StatCard(
                    label: "Artists",
                    value: overview.diversity.uniqueArtists.formatted(),
                    hint: "unique",
                    systemImage: "person.fill",
                    accent: accent
                )
                StatCard(
                    label: "Min / day",
                    value: overview.avgMinPerDay.formatted(),
                    hint: "~\(overview.calendarDays) days",
                    systemImage: "calendar",
                    accent: accent
                )
                StatCard(
                    label: "Plays / day",
                    value: overview.avgStreamsPerDay.formatted(),
                    hint: nil,
                    systemImage: "chart.line.uptrend.xyaxis",
                    accent: accent
                )
            }
        } else {
            HStack(spacing: 8) {
                StatCard(
                    label: "Minutes",
                    value: overview.totals.totalMinutes.formatted(),
                    hint: "\(overview.totals.totalHours.formatted()) hours",
                    systemImage: "clock.fill",
                    style: .hero,
                    accent: accent
                )
                StatCard(
                    label: "Plays",
                    value: overview.totals.totalStreams.formatted(),
                    hint: overview.filter.label,
                    systemImage: "play.fill",
                    style: .hero,
                    accent: accent
                )
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                StatCard(
                    label: "Tracks",
                    value: overview.diversity.uniqueTracks.formatted(),
                    hint: "unique",
                    systemImage: "music.note",
                    accent: accent
                )
                StatCard(
                    label: "Artists",
                    value: overview.diversity.uniqueArtists.formatted(),
                    hint: "unique",
                    systemImage: "person.fill",
                    accent: accent
                )
                StatCard(
                    label: "Min / day",
                    value: overview.avgMinPerDay.formatted(),
                    hint: "~\(overview.calendarDays) days",
                    systemImage: "calendar",
                    accent: accent
                )
                StatCard(
                    label: "Plays / day",
                    value: overview.avgStreamsPerDay.formatted(),
                    hint: nil,
                    systemImage: "chart.line.uptrend.xyaxis",
                    accent: accent
                )
            }
        }
    }

    @ViewBuilder
    private var insightRow: some View {
        if let patterns {
            let peakHour = StatsEngine.peakHour(from: patterns)
            let peakDay = StatsEngine.peakDay(from: patterns)
            HStack(spacing: 8) {
                InsightCard(
                    label: "Busiest hour",
                    primaryValue: peakHour.map { formatHourLabel($0.label) } ?? "—",
                    detail: peakHour.map { "\($0.minutes.formatted()) min · \($0.streams.formatted()) plays" } ?? "No plays in this range.",
                    accent: accent
                )
                InsightCard(
                    label: "Busiest day",
                    primaryValue: peakDay?.label ?? "—",
                    detail: peakDay.map { "\($0.minutes.formatted()) min · \($0.streams.formatted()) plays" } ?? "No plays in this range.",
                    accent: accent
                )
            }
        }
    }

    @ViewBuilder
    private var insightPanel: some View {
        if let patterns {
            let peakHour = StatsEngine.peakHour(from: patterns)
            let peakDay = StatsEngine.peakDay(from: patterns)
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Patterns", subtitle: "When listening peaks")
                insightTile(
                    label: "Busiest hour",
                    value: peakHour.map { formatHourLabel($0.label) } ?? "—",
                    detail: peakHour.map { "\($0.minutes.formatted()) min · \($0.streams.formatted()) plays" } ?? "No plays in this range.",
                    systemImage: "clock.fill"
                )
                insightTile(
                    label: "Busiest day",
                    value: peakDay?.label ?? "—",
                    detail: peakDay.map { "\($0.minutes.formatted()) min · \($0.streams.formatted()) plays" } ?? "No plays in this range.",
                    systemImage: "calendar"
                )
            }
            .soundfolioCard()
        }
    }

    private func insightTile(label: String, value: String, detail: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent)
                .frame(width: 30, height: 30)
                .background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(accent)
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var recentPreviewSection: some View {
        SectionHeader(
            title: "Recent plays",
            subtitle: "Last \(recentPreview.count) listens",
            actionTitle: "See all",
            action: { navigation.openLibrary(.recent) }
        )

        VStack(alignment: .leading, spacing: 10) {
            if recentPreview.isEmpty {
                Text("No recent plays yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(recentPreview.prefix(horizontalSizeClass == .regular ? 6 : 7))) { stream in
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
        .soundfolioCard()
    }

    @ViewBuilder
    private func recentRow(_ stream: RecentStream) -> some View {
        HStack(spacing: 12) {
            ArtworkView(urlString: stream.albumArt, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(stream.trackName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(stream.artistName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
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
        .padding(10)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private func rankingsPreviewSection(_ overview: OverviewResponse) -> some View {
        SectionHeader(
            title: "Top rankings",
            subtitle: "By \(preferences.sort.label.lowercased())",
            actionTitle: "See all",
            action: { navigation.openLibrary(.rankings) }
        )

        VStack(alignment: .leading, spacing: 8) {
            Picker("Kind", selection: $previewKind) {
                ForEach(TopListKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }
            .pickerStyle(.segmented)

            if horizontalSizeClass == .regular {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 0) {
                    rankingsRows(overview)
                }
            } else {
                VStack(spacing: 0) {
                    rankingsRows(overview)
                }
            }
        }
        .soundfolioCard()
    }

    @ViewBuilder
    private func rankingsRows(_ overview: OverviewResponse) -> some View {
        switch previewKind {
        case .tracks:
            ForEach(Array(overview.topTracks.enumerated()), id: \.element.id) { index, track in
                RankedRow(
                    rank: index + 1,
                    title: track.trackName,
                    subtitle: track.artistName,
                    value: RankValueFormatter.primary(minutes: track.minutesListened, streams: track.streams, sort: preferences.sort),
                    artworkURL: track.albumArt,
                    destination: TrackDetailView(trackName: track.trackName, artistName: track.artistName, preferences: preferences)
                )
            }
        case .artists:
            ForEach(Array(overview.topArtists.enumerated()), id: \.element.id) { index, artist in
                RankedRow(
                    rank: index + 1,
                    title: artist.artistName,
                    subtitle: RankValueFormatter.secondary(minutes: artist.minutesListened, streams: artist.streams, sort: preferences.sort),
                    value: RankValueFormatter.primary(minutes: artist.minutesListened, streams: artist.streams, sort: preferences.sort),
                    artworkURL: artist.artistArt,
                    isCircleArt: true,
                    destination: ArtistDetailView(artistName: artist.artistName, preferences: preferences)
                )
            }
        case .albums:
            ForEach(Array(overview.topAlbums.enumerated()), id: \.element.id) { index, album in
                RankedRow(
                    rank: index + 1,
                    title: album.albumName,
                    subtitle: album.artistName,
                    value: RankValueFormatter.primary(minutes: album.minutesListened, streams: album.streams, sort: preferences.sort),
                    artworkURL: album.albumArt,
                    destination: AlbumDetailView(albumName: album.albumName, artistName: album.artistName, preferences: preferences)
                )
            }
        }
    }

    private func relativeTimestamp(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "music.note.list")
                .font(.title)
                .foregroundStyle(accent)
            Text("No data yet")
                .font(.headline)
            Text("Import history on the web, sync Last.fm, then pull to refresh.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let url = preferences.importURL {
                Link("Import on web", destination: url)
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
        if streamStore.streams.isEmpty {
            loading = streamStore.isLoading
            if loading { return }
        }
        loading = false
        error = nil
        let revision = streamStore.revision
        overview = statsCache.overview(streams: streamStore.streams, preferences: preferences, revision: revision)
        patterns = statsCache.patterns(streams: streamStore.streams, preferences: preferences, revision: revision)
        recentPreview = statsCache.recentStreams(from: streamStore.streams, limit: 7, preferences: nil, revision: revision)
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
