import SwiftUI

struct PatternsView: View {
    @Environment(AppState.self) private var appState
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var preferences: StatsPreferences
    var embedInLibrary = false
    @State private var data: PatternsResponse?
    @State private var loading = true
    @State private var error: String?
    @State private var metric: TopSortMode = .minutes

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing(for: horizontalSizeClass)) {
                FilterToolbar(preferences: preferences, context: .patterns)

                SoundfolioSegmentedControl(
                    title: "Show",
                    options: [(TopSortMode.minutes, "Time"), (TopSortMode.streams, "Plays")],
                    selection: $metric
                )

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if let error {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(SoundfolioTheme.rowSubtitleFont)
                            .foregroundStyle(SoundfolioTheme.mutedForeground)
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 80)
                } else if let data {
                    insightRow(data)

                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 12) {
                            rankedList(title: "By hour", rows: hourRows(data))
                            rankedList(title: "By weekday", rows: dayRows(data))
                        }
                    } else {
                        rankedList(title: "By hour", rows: hourRows(data))
                        rankedList(title: "By weekday", rows: dayRows(data))
                    }
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(embedInLibrary ? "" : "Patterns")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !embedInLibrary {
                ToolbarItem(placement: .topBarTrailing) {
                    SyncToolbarButton()
                }
            }
        }
        .refreshable { await refresh() }
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(streamStore.revision)"
    }

    @ViewBuilder
    private func insightRow(_ data: PatternsResponse) -> some View {
        let peakHour = StatsEngine.peakHour(from: data)
        let peakDay = StatsEngine.peakDay(from: data)
        HStack(spacing: 8) {
            InsightCard(
                label: "Busiest hour",
                primaryValue: peakHour.map { formatHourLabel($0.label) } ?? "—",
                detail: peakHour.map { metricDetail($0.minutes, $0.streams) } ?? "No plays in this range.",
                accent: accent
            )
            InsightCard(
                label: "Busiest day",
                primaryValue: peakDay?.label ?? "—",
                detail: peakDay.map { metricDetail($0.minutes, $0.streams) } ?? "No plays in this range.",
                accent: accent
            )
        }
    }

    private func metricDetail(_ minutes: Int, _ streams: Int) -> String {
        metric == .streams
            ? "\(streams.formatted()) plays"
            : "\(minutes.formatted()) min"
    }

    private struct PatternRowData: Identifiable {
        let id: String
        let label: String
        let value: String
        let fraction: Double
    }

    private func hourRows(_ data: PatternsResponse) -> [PatternRowData] {
        let values = data.byHour.map { metric == .minutes ? $0.minutes : $0.streams }
        let maxValue = max(values.max() ?? 1, 1)
        return data.byHour.map { point in
            let raw = metric == .minutes ? point.minutes : point.streams
            return PatternRowData(
                id: point.label,
                label: formatHourLabel(point.label),
                value: RankValueFormatter.primary(minutes: point.minutes, streams: point.streams, sort: metric),
                fraction: Double(raw) / Double(maxValue)
            )
        }
        .sorted { $0.fraction > $1.fraction }
    }

    private func dayRows(_ data: PatternsResponse) -> [PatternRowData] {
        let values = data.byDay.map { metric == .minutes ? $0.minutes : $0.streams }
        let maxValue = max(values.max() ?? 1, 1)
        return data.byDay.map { point in
            let raw = metric == .minutes ? point.minutes : point.streams
            return PatternRowData(
                id: point.label,
                label: point.label,
                value: RankValueFormatter.primary(minutes: point.minutes, streams: point.streams, sort: metric),
                fraction: Double(raw) / Double(maxValue)
            )
        }
        .sorted { $0.fraction > $1.fraction }
    }

    private func rankedList(title: String, rows: [PatternRowData]) -> some View {
        RankColumn(title: title) {
            VStack(spacing: 0) {
                ForEach(rows) { row in
                    PatternRankRow(
                        label: row.label,
                        value: row.value,
                        fraction: row.fraction,
                        accent: accent
                    )
                }
            }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        error = nil
        data = statsCache.patterns(
            streams: streamStore.streams,
            preferences: preferences,
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
