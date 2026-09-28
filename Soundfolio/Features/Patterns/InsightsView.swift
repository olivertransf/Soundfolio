import Charts
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                FilterToolbar(preferences: preferences, context: .patterns)

                let summary = StatsEngine.insightSummary(from: streamStore.streams, preferences: preferences)
                HStack(spacing: 8) {
                    summaryCell("Albums", value: summary.uniqueAlbums.formatted(), hint: nil)
                    summaryCell(
                        "Most active day",
                        value: summary.mostActiveDay ?? "—",
                        hint: summary.mostActiveDay == nil ? nil : "\(summary.mostActiveMinutes.formatted()) min"
                    )
                    summaryCell("Top 10 tracks", value: "\(summary.topTenShare)%", hint: "of minutes")
                }

                chartPanel(title: "Listening over time") {
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

                chartPanel(title: "Time of day") {
                    hourChart
                }

                chartPanel(title: "Day of week") {
                    weekdayChart
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
        return chart(points)
    }

    private var hourChart: some View {
        let points = StatsEngine.patterns(from: streamStore.streams, preferences: preferences).byHour.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return chart(points)
    }

    private var weekdayChart: some View {
        let points = StatsEngine.patterns(from: streamStore.streams, preferences: preferences).byDay.map {
            HistoryPoint(label: $0.label, minutes: $0.minutes, streams: $0.streams)
        }
        return chart(points)
    }

    private func chart(_ points: [HistoryPoint]) -> some View {
        Chart(points) { point in
            BarMark(
                x: .value("When", point.label),
                y: .value(metric.label, metric == .minutes ? point.minutes : point.streams)
            )
            .foregroundStyle(SoundfolioTheme.accent(from: preferences))
        }
        .frame(height: 160)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4))
        }
    }

    private func chartPanel<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(SoundfolioTheme.labelFont)
                .tracking(0.8)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            content()
        }
        .soundfolioPanel(preferences: preferences)
    }

    private func summaryCell(_ title: String, value: String, hint: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(SoundfolioFont.semibold(10))
                .tracking(0.6)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            Text(value)
                .font(SoundfolioTheme.rowTitleFont)
                .lineLimit(1)
            if let hint {
                Text(hint)
                    .font(SoundfolioTheme.captionFont)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .soundfolioPanel(preferences: preferences)
    }
}
