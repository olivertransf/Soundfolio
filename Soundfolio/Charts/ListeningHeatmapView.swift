import SwiftUI

struct ListeningHeatmapView: View {
    let grid: [HeatmapCell]
    let dayNames: [String]
    var accent: Color

    private var maxCount: Int {
        max(grid.map(\.count).max() ?? 1, 1)
    }

    private var peakCell: HeatmapCell? {
        grid.filter { $0.count > 0 }.max(by: { $0.count < $1.count })
    }

    private var totalPlays: Int {
        grid.reduce(0) { $0 + $1.count }
    }

    private func count(day: Int, hour: Int) -> Int {
        grid.first { $0.day == day && $0.hour == hour }?.count ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(totalPlays.formatted()) play count in period")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let peak = peakCell, peak.count > 0 {
                let dayName = peak.day < dayNames.count ? dayNames[peak.day] : "Day \(peak.day)"
                Text("Peak: \(dayName) at \(peak.hour):00 (\(peak.count.formatted()) plays)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Peak listening at \(dayName) \(peak.hour) hundred hours, \(peak.count) plays")
            }

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
                                let cellCount = count(day: day, hour: hour)
                                let isPeak = peakCell?.day == day && peakCell?.hour == hour && cellCount > 0
                                RoundedRectangle(cornerRadius: 2, style: .continuous)
                                    .fill(cellColor(count: cellCount))
                                    .overlay {
                                        if isPeak {
                                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                                .strokeBorder(accent, lineWidth: 1.5)
                                        }
                                    }
                                    .frame(width: 14, height: 14)
                                    .accessibilityLabel(accessibilityLabel(day: day, hour: hour, count: cellCount))
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }

            HStack(spacing: 6) {
                Text("Less")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                ForEach(0 ..< 4, id: \.self) { step in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(legendColor(step: step))
                        .frame(width: 16, height: 10)
                }
                Text("More")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func cellColor(count: Int) -> Color {
        if count == 0 { return Color(.tertiarySystemFill) }
        let t = min(1, Double(count) / Double(maxCount))
        return accent.opacity(0.2 + t * 0.85)
    }

    private func legendColor(step: Int) -> Color {
        let levels: [Double] = [0, 0.33, 0.66, 1]
        let t = levels[step]
        return t == 0 ? Color(.tertiarySystemFill) : accent.opacity(0.2 + t * 0.85)
    }

    private func accessibilityLabel(day: Int, hour: Int, count: Int) -> String {
        let dayName = day < dayNames.count ? dayNames[day] : "Day \(day)"
        return "\(dayName) \(hour):00, \(count) plays"
    }
}
