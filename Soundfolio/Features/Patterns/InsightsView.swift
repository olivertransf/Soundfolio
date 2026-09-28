import SwiftUI

struct InsightsView: View {
    @Environment(StreamStore.self) private var streamStore
    @Bindable var preferences: StatsPreferences
    var embedInLibrary = false
    @State private var grain: HistoryGrain = .weeks
    @State private var metric: ChartMetric = .minutes

    private enum ChartMetric: String, CaseIterable, Identifiable {
        case minutes
        case plays

        var id: String { rawValue }
        var label: String { self == .minutes ? "Minutes" : "Plays" }
    }

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    private var rangeLabel: String {
        StatsEngine.parseTimeRange(preferences: preferences).label
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .patterns)

                let summary = StatsEngine.insightSummary(from: streamStore.streams, preferences: preferences)
                HStack(spacing: 8) {
                    StatCard(label: "Albums", value: summary.uniqueAlbums.formatted(), accent: accent)
                    StatCard(
                        label: "Most active day",
                        value: summary.mostActiveDay ?? "—",
                        hint: summary.mostActiveDay == nil ? nil : "\(summary.mostActiveMinutes.formatted()) min",
                        accent: accent
                    )
                    StatCard(label: "Top 10 tracks", value: "\(summary.topTenShare)%", hint: "of minutes", accent: accent)
                }

                ChartPanel(
                    title: ChartCopy.historyTitle(grain: grain, metric: metric.label),
                    caption: ChartCopy.caption(range: rangeLabel, metric: metric.label)
                ) {
                    Picker("Group", selection: $grain) {
                        Text("Days").tag(HistoryGrain.days)
                        Text("Weeks").tag(HistoryGrain.weeks)
                        Text("Months").tag(HistoryGrain.months)
                    }
                    .pickerStyle(.segmented)
                    Picker("Metric", selection: $metric) {
                        ForEach(ChartMetric.allCases) { item in
                            Text(item.label).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    historyChart
                }

                ChartPanel(
                    title: metric == .minutes ? "Minutes by hour" : "Plays by hour",
                    caption: ChartCopy.caption(range: rangeLabel, metric: metric.label)
                ) {
                    hourChart
                }

                ChartPanel(
                    title: metric == .minutes ? "Minutes by weekday" : "Plays by weekday",
                    caption: ChartCopy.caption(range: rangeLabel, metric: metric.label)
                ) {
                    weekdayChart
                }

                ChartPanel(title: "Top 10 share", caption: "Share of minutes in this period") {
                    SeriesChart(
                        points: [
                            HistoryPoint(label: "Top 10", minutes: summary.topTenMinutes, streams: 0),
                            HistoryPoint(label: "Rest", minutes: summary.restMinutes, streams: 0),
                        ],
                        metricLabel: "Minutes",
                        useMinutes: true,
                        accent: accent
                    )
                }
            }
            .soundfolioPage()
        }
        .navigationTitle(embedInLibrary ? "" : "Insights")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var historyChart: some View {
        let points = StatsEngine.historySeries(
            from: streamStore.streams,
            preferences: preferences,
            grain: grain
        )
        return series(points)
    }

    private var hourChart: some View {
        let points = StatsEngine.patterns(from: streamStore.streams, preferences: preferences).byHour.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return series(points)
    }

    private var weekdayChart: some View {
        let points = StatsEngine.patterns(from: streamStore.streams, preferences: preferences).byDay.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return series(points)
    }

    private func series(_ points: [HistoryPoint]) -> some View {
        SeriesChart(
            points: points,
            metricLabel: metric.label,
            useMinutes: metric == .minutes,
            accent: accent
        )
    }
}
