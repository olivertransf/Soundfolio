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
    @State private var metric: ChartMetric = .minutes

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing(for: horizontalSizeClass)) {
                FilterToolbar(preferences: preferences, context: .patterns)

                Text("Hours use your local timezone (\(TimeZone.current.identifier.replacingOccurrences(of: "_", with: " "))).")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if let error {
                    VStack(spacing: 8) {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 80)
                } else if let data {
                    insightRow(data)
                    metricPicker
                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 16) {
                            patternCard(title: "By hour of day") {
                                SoundfolioBarChart(
                                    points: data.byHour.map { ($0.label, Double(metric == .minutes ? $0.minutes : $0.streams)) },
                                    labelStyle: .hourOfDay,
                                    yValueSuffix: metric == .minutes ? "m" : nil,
                                    accent: accent
                                )
                            }
                            patternCard(title: "By weekday") {
                                SoundfolioBarChart(
                                    points: data.byDay.map { ($0.label, Double(metric == .minutes ? $0.minutes : $0.streams)) },
                                    labelStyle: .weekday,
                                    yValueSuffix: metric == .minutes ? "m" : nil,
                                    accent: accent
                                )
                            }
                        }
                    } else {
                        patternCard(title: "By hour of day") {
                            SoundfolioBarChart(
                                points: data.byHour.map { ($0.label, Double(metric == .minutes ? $0.minutes : $0.streams)) },
                                labelStyle: .hourOfDay,
                                yValueSuffix: metric == .minutes ? "m" : nil,
                                accent: accent
                            )
                        }
                        patternCard(title: "By weekday") {
                            SoundfolioBarChart(
                                points: data.byDay.map { ($0.label, Double(metric == .minutes ? $0.minutes : $0.streams)) },
                                labelStyle: .weekday,
                                yValueSuffix: metric == .minutes ? "m" : nil,
                                accent: accent
                            )
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Week × hour")
                            .font(.subheadline.weight(.semibold))
                        ListeningHeatmapView(
                            grid: data.heatmap.grid,
                            dayNames: data.heatmap.dayNames,
                            accent: accent
                        )
                    }
                    .soundfolioCard()
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

    private var metricPicker: some View {
        Picker("Metric", selection: $metric) {
            ForEach(ChartMetric.allCases) { m in
                Text(m.rawValue.capitalized).tag(m)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func insightRow(_ data: PatternsResponse) -> some View {
        let peakHour = StatsEngine.peakHour(from: data)
        let peakDay = StatsEngine.peakDay(from: data)
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

    private func patternCard<Content: View>(title: String, @ViewBuilder chart: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            chart()
        }
        .soundfolioCard()
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
            _ = try await appState.syncLastFm()
            await load()
        } catch {
            self.error = appState.handleError(error)
        }
    }
}
