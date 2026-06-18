import SwiftUI

enum ChartFormatting {
    static let yAxisWidth: CGFloat = 36
    static let xLabelHeight: CGFloat = 18
    static let barGap: CGFloat = 4

    static func slotWidth(labelStyle: ChartAxisLabelStyle) -> CGFloat {
        switch labelStyle {
        case .hourOfDay: 28
        case .weekday: 40
        case .listeningHistory(.days): 24
        case .listeningHistory(.weeks): 32
        case .listeningHistory(.months): 36
        case .automatic: 28
        }
    }

    struct BarLayout {
        let contentWidth: CGFloat
        let slotWidth: CGFloat
        let barWidth: CGFloat
    }

    /// At least `availableWidth`; wider when natural width exceeds the viewport (scroll).
    static func layout(
        pointCount: Int,
        labelStyle: ChartAxisLabelStyle,
        availableWidth: CGFloat
    ) -> BarLayout {
        guard pointCount > 0, availableWidth > 0 else {
            return BarLayout(contentWidth: availableWidth, slotWidth: 28, barWidth: 24)
        }
        let minSlot = slotWidth(labelStyle: labelStyle)
        let naturalWidth = CGFloat(pointCount) * minSlot
        let contentWidth = max(availableWidth, naturalWidth)
        let slot = contentWidth / CGFloat(pointCount)
        let barWidth = max(6, slot - barGap)
        return BarLayout(contentWidth: contentWidth, slotWidth: slot, barWidth: barWidth)
    }

    static func shouldShowXLabel(index: Int, count: Int) -> Bool {
        guard count > 0 else { return false }
        if count <= 12 { return true }
        if count <= 24 {
            return index % 2 == 0 || index == count - 1
        }
        let step = max(1, count / 8)
        return index % step == 0 || index == count - 1
    }

    static func yAxisTicks(maxValue: Double) -> [Double] {
        let ceiling = max(1, ceil(maxValue * 1.08))
        if ceiling <= 2 { return [0, ceiling] }
        return [0, ceiling / 2, ceiling]
    }
}

struct SoundfolioBarChart: View {
    let points: [(label: String, value: Double)]
    var labelStyle: ChartAxisLabelStyle = .automatic
    var yValueSuffix: String? = "m"
    var accent: Color
    var chartHeight: CGFloat = SoundfolioTheme.chartHeight

    private var maxValue: Double { max(points.map(\.value).max() ?? 0, 1) }
    private var yCeiling: Double { max(1, ceil(maxValue * 1.08)) }
    private var plotHeight: CGFloat { chartHeight - ChartFormatting.xLabelHeight - 6 }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            yAxis
                .frame(width: ChartFormatting.yAxisWidth, height: plotHeight)

            GeometryReader { geometry in
                let layout = ChartFormatting.layout(
                    pointCount: points.count,
                    labelStyle: labelStyle,
                    availableWidth: geometry.size.width
                )
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .bottom, spacing: 0) {
                            ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                                barColumn(
                                    index: index,
                                    point: point,
                                    slotWidth: layout.slotWidth,
                                    barWidth: layout.barWidth
                                )
                                .id(index)
                            }
                        }
                        .frame(width: layout.contentWidth, height: chartHeight, alignment: .bottomLeading)
                        .padding(.trailing, 8)
                    }
                    .onAppear {
                        scrollToPresent(proxy)
                    }
                    .onChange(of: points.count) { _, _ in
                        scrollToPresent(proxy)
                    }
                    .onChange(of: labelStyle) { _, _ in
                        scrollToPresent(proxy)
                    }
                }
            }
            .frame(height: chartHeight)
        }
        .frame(height: chartHeight)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var yAxis: some View {
        let ticks = ChartFormatting.yAxisTicks(maxValue: maxValue)
        return ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                ForEach(0 ..< ticks.count - 1, id: \.self) { _ in
                    gridLine
                    Spacer(minLength: 0)
                }
                gridLine
            }

            VStack(alignment: .trailing, spacing: 0) {
                ForEach(Array(ticks.reversed().enumerated()), id: \.offset) { offset, tick in
                    if offset > 0 { Spacer(minLength: 0) }
                    Text(formatYAxis(tick))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .padding(.trailing, 4)
        }
    }

    private var gridLine: some View {
        Rectangle()
            .fill(Color.secondary.opacity(0.2))
            .frame(height: 0.5)
    }

    @ViewBuilder
    private func barColumn(
        index: Int,
        point: (label: String, value: Double),
        slotWidth: CGFloat,
        barWidth: CGFloat
    ) -> some View {
        let barHeight = max(2, CGFloat(point.value / yCeiling) * plotHeight)
        let showLabel = ChartFormatting.shouldShowXLabel(index: index, count: points.count)

        VStack(spacing: 4) {
            ZStack(alignment: .bottom) {
                Color.clear
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [accent, accent.opacity(0.2)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: barWidth, height: barHeight)
            }
            .frame(width: slotWidth, height: plotHeight, alignment: .bottom)

            Group {
                if showLabel {
                    Text(ChartLabelFormatter.format(point.label, style: labelStyle))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                } else {
                    Text(" ")
                        .font(.caption2)
                }
            }
            .frame(width: slotWidth, height: ChartFormatting.xLabelHeight)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(ChartLabelFormatter.accessibilityLabel(point.label, style: labelStyle))
        .accessibilityValue(accessibilityValue(for: point.value))
    }

    private func accessibilityValue(for value: Double) -> String {
        let n = Int(value.rounded())
        if let suffix = yValueSuffix, !suffix.isEmpty {
            return "\(n) \(suffix == "m" ? "minutes" : suffix)"
        }
        return "\(n)"
    }

    private func formatYAxis(_ value: Double) -> String {
        let n = Int(value.rounded())
        if let suffix = yValueSuffix, !suffix.isEmpty {
            return "\(compactNumber(n))\(suffix)"
        }
        return compactNumber(n)
    }

    private func compactNumber(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fk", Double(n) / 1_000) }
        return "\(n)"
    }

    private func scrollToPresent(_ proxy: ScrollViewProxy) {
        guard labelStyle.anchorsToPresent, !points.isEmpty else { return }
        let lastIndex = points.count - 1
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(50))
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastIndex, anchor: .trailing)
            }
        }
    }
}

typealias SoundfolioCategoryBarChart = SoundfolioBarChart
