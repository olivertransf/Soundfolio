import SwiftUI

struct ListeningChartView: View {
    let points: [HistoryPoint]
    let metric: ChartMetric
    var groupBy: ChartGroupBy = .weeks
    var accent: Color = Color(red: 30 / 255, green: 215 / 255, blue: 96 / 255)

    private var chartPoints: [(label: String, value: Double)] {
        points.map { point in
            let value = metric == .minutes ? Double(point.minutes) : Double(point.streams)
            return (point.label, value)
        }
    }

    var body: some View {
        SoundfolioBarChart(
            points: chartPoints,
            labelStyle: .listeningHistory(groupBy),
            yValueSuffix: metric == .minutes ? "m" : nil,
            accent: accent
        )
    }
}

struct ListeningChartSection: View {
    @Environment(StreamStore.self) private var streamStore
    @Environment(StatsCache.self) private var statsCache
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Bindable var preferences: StatsPreferences
    @State private var points: [HistoryPoint] = []
    @State private var loading = true
    @State private var error: String?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    private var subtitle: String {
        let filter = StatsEngine.parseTimeRange(preferences: preferences)
        return "\(preferences.chartGroupBy.label) totals for \(filter.label.lowercased())"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Listening history")
                        .font(.subheadline.weight(.semibold))
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Picker("Granularity", selection: $preferences.chartGroupBy) {
                    ForEach(ChartGroupBy.allCases) { group in
                        Text(group.label).tag(group)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
            }

            Picker("Metric", selection: $preferences.chartMetric) {
                ForEach(ChartMetric.allCases) { m in
                    Text(m.rawValue.capitalized).tag(m)
                }
            }
            .pickerStyle(.segmented)

            chartBody

            if let first = points.first?.label, let last = points.last?.label, points.count > 1 {
                Text("\(first) – \(last)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .soundfolioCard()
        .task(id: taskID) { await load() }
    }

    @ViewBuilder
    private var chartBody: some View {
        Group {
            if loading {
                ProgressView()
                    .frame(height: chartHeight)
            } else if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(height: chartHeight)
            } else if points.isEmpty {
                VStack(spacing: 4) {
                    Text("No listening in this period")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Try widening the date range.")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .frame(height: chartHeight)
            } else {
                ListeningChartView(
                    points: points,
                    metric: preferences.chartMetric,
                    groupBy: preferences.chartGroupBy,
                    accent: accent
                )
                .frame(height: chartHeight)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var chartHeight: CGFloat {
        horizontalSizeClass == .regular ? SoundfolioTheme.chartHeightRegular : SoundfolioTheme.chartHeight
    }

    private var taskID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(preferences.chartGroupBy.rawValue)-\(preferences.chartMetric.rawValue)-\(streamStore.revision)"
    }

    private func load() async {
        loading = true
        error = nil
        points = statsCache.historyPoints(
            streams: streamStore.streams,
            preferences: preferences,
            revision: streamStore.revision
        )
        loading = false
    }
}
