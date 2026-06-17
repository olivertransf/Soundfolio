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
    @Bindable var preferences: StatsPreferences
    @State private var points: [HistoryPoint] = []
    @State private var loading = true
    @State private var error: String?
    @State private var metric: ChartMetric = .minutes

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Listening")
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                Picker("Granularity", selection: $preferences.chartGroupBy) {
                    ForEach(ChartGroupBy.allCases) { group in
                        Text(group.label).tag(group)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
            }

            Picker("Metric", selection: $metric) {
                ForEach(ChartMetric.allCases) { m in
                    Text(m.rawValue.capitalized).tag(m)
                }
            }
            .pickerStyle(.segmented)

            chartBody
        }
        .soundfolioCard()
        .task(id: taskID) { await load() }
    }

    @ViewBuilder
    private var chartBody: some View {
        Group {
            if loading {
                ProgressView()
                    .frame(height: SoundfolioTheme.chartHeight)
            } else if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(height: SoundfolioTheme.chartHeight)
            } else if points.isEmpty {
                Text("No chart data")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(height: SoundfolioTheme.chartHeight)
            } else {
                ListeningChartView(
                    points: points,
                    metric: metric,
                    groupBy: preferences.chartGroupBy,
                    accent: SoundfolioTheme.accent(from: preferences)
                )
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var taskID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.sort.rawValue)-\(preferences.chartGroupBy.rawValue)-\(streamStore.streams.count)"
    }

    private func load() async {
        loading = true
        error = nil
        points = StatsEngine.historyPoints(from: streamStore.streams, preferences: preferences)
        loading = false
    }
}
