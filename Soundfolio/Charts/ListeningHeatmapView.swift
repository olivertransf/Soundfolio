import SwiftUI

struct ListeningHeatmapView: View {
    let grid: [HeatmapCell]
    let dayNames: [String]
    var accent: Color

    private var maxCount: Int {
        max(grid.map(\.count).max() ?? 1, 1)
    }

    private func count(day: Int, hour: Int) -> Int {
        grid.first { $0.day == day && $0.hour == hour }?.count ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(grid.reduce(0) { $0 + $1.count }.formatted()) streams in view")
                .font(.caption)
                .foregroundStyle(.secondary)

            ScrollView(.horizontal, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 3) {
                        Color.clear.frame(width: 36, height: 12)
                        ForEach(0 ..< 24, id: \.self) { hour in
                            if hour % 3 == 0 {
                                Text("\(hour)")
                                    .font(.system(size: 9))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 14)
                            } else {
                                Color.clear.frame(width: 14, height: 12)
                            }
                        }
                    }

                    ForEach(0 ..< 7, id: \.self) { day in
                        HStack(spacing: 3) {
                            Text(day < dayNames.count ? dayNames[day] : "")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .frame(width: 36, alignment: .leading)

                            ForEach(0 ..< 24, id: \.self) { hour in
                                let count = count(day: day, hour: hour)
                                RoundedRectangle(cornerRadius: 2, style: .continuous)
                                    .fill(cellColor(count: count))
                                    .frame(width: 14, height: 14)
                                    .accessibilityLabel(accessibilityLabel(day: day, hour: hour, count: count))
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func cellColor(count: Int) -> Color {
        if count == 0 { return Color(.tertiarySystemFill) }
        let t = min(1, Double(count) / Double(maxCount))
        return accent.opacity(0.2 + t * 0.85)
    }

    private func accessibilityLabel(day: Int, hour: Int, count: Int) -> String {
        let dayName = day < dayNames.count ? dayNames[day] : "Day \(day)"
        return "\(dayName) \(hour):00, \(count) plays"
    }
}
