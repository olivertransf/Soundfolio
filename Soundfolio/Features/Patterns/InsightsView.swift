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
                let breakdown = StatsEngine.periodBreakdown(from: streamStore.streams, preferences: preferences)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    StatCard(label: "Albums", value: summary.uniqueAlbums.formatted(), accent: accent)
                    StatCard(
                        label: "Most active day",
                        value: shortDay(summary.mostActiveDay),
                        hint: summary.mostActiveDay == nil ? nil : "\(summary.mostActiveMinutes.formatted()) min",
                        accent: accent
                    )
                    StatCard(label: "Top 10 tracks", value: "\(summary.topTenShare)%", hint: "of minutes", accent: accent)
                    StatCard(
                        label: "Peak hour",
                        value: breakdown.peakHour,
                        hint: breakdown.peakHour == "—" ? nil : "\(breakdown.peakHourMinutes.formatted()) min",
                        accent: accent
                    )
                    StatCard(label: "Avg / play", value: breakdown.averageMinutesPerPlay.formatted(), hint: "min", accent: accent)
                    StatCard(label: "Active days", value: breakdown.activeDays.formatted(), accent: accent)
                    StatCard(label: "Replays", value: "\(breakdown.replayShare)%", hint: "of minutes", accent: accent)
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

                ChartPanel(
                    title: metric == .minutes ? "Minutes by time of day" : "Plays by time of day",
                    caption: "\(ChartCopy.caption(range: rangeLabel, metric: metric.label)) · Night 12a-6a, morning 6a-12p, afternoon 12p-6p, evening 6p-12a"
                ) {
                    SeriesChart(
                        points: breakdown.dayparts,
                        metricLabel: metric.label,
                        useMinutes: metric == .minutes,
                        accent: accent
                    )
                }

                ChartPanel(
                    title: metric == .minutes ? "Weekday vs weekend" : "Plays on weekdays and weekends",
                    caption: "\(ChartCopy.caption(range: rangeLabel, metric: metric.label)) · Monday-Friday versus Saturday-Sunday"
                ) {
                    SeriesChart(
                        points: breakdown.weekParts,
                        metricLabel: metric.label,
                        useMinutes: metric == .minutes,
                        accent: accent
                    )
                }

                ChartPanel(
                    title: "Minutes by artist",
                    caption: "\(ChartCopy.caption(range: rangeLabel, metric: "Minutes")) · Top 5 and the rest"
                ) {
                    SeriesChart(points: breakdown.artistShare, metricLabel: "Minutes", useMinutes: true, accent: accent)
                }

                ChartPanel(
                    title: "Minutes from replays",
                    caption: "\(ChartCopy.caption(range: rangeLabel, metric: "Minutes")) · Tracks heard once versus played again"
                ) {
                    SeriesChart(points: breakdown.replays, metricLabel: "Minutes", useMinutes: true, accent: accent)
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

    private func shortDay(_ label: String?) -> String {
        guard let label else { return "—" }
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: label) else { return label }
        let display = DateFormatter()
        display.setLocalizedDateFormatFromTemplate("MMMd")
        return display.string(from: date)
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
