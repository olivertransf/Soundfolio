import Charts
import SwiftUI

struct ChartPanel<Content: View>: View {
    @Environment(StatsPreferences.self) private var preferences
    let title: String
    let caption: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(SoundfolioTheme.rowTitleFont)
            Text(caption)
                .font(SoundfolioTheme.captionFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .soundfolioPanel(preferences: preferences)
    }
}

struct SeriesChart: View {
    let points: [HistoryPoint]
    var metricLabel: String
    var useMinutes: Bool
    var accent: Color

    var body: some View {
        Chart(points) { point in
            BarMark(
                x: .value("When", point.label),
                y: .value(metricLabel, useMinutes ? point.minutes : point.streams)
            )
            .foregroundStyle(accent)
            .cornerRadius(4)
        }
        .frame(height: 160)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4))
        }
        .chartYAxis {
            AxisMarks(position: .leading)
        }
        .chartYAxisLabel(metricLabel, position: .leading)
    }
}

enum ChartCopy {
    static func historyTitle(grain: HistoryGrain, metric: String) -> String {
        let unit: String
        switch grain {
        case .days:
            unit = "day"
        case .weeks:
            unit = "week"
        case .months:
            unit = "month"
        }
        return "\(metric) by \(unit)"
    }

    static func caption(range: String, metric: String) -> String {
        "\(range) · \(metric)"
    }
}
