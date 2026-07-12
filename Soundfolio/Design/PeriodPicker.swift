import SwiftUI

struct PeriodPicker: View {
    @Bindable var preferences: StatsPreferences
    @State private var showCustomRange = false
    @State private var customFromDate = Date()
    @State private var customToDate = Date()

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("PERIOD")
                .font(SoundfolioTheme.labelFont)
                .tracking(0.6)
                .foregroundStyle(SoundfolioTheme.mutedForeground)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    if preferences.usesCustomRange {
                        customRangeChip
                    }
                    ForEach(StatsPeriod.allCases) { period in
                        if period == .all || !preferences.usesCustomRange {
                            periodChip(period)
                        }
                    }
                    if !preferences.usesCustomRange {
                        customButton
                    }
                }
            }
        }
        .sheet(isPresented: $showCustomRange) {
            customRangeSheet
        }
    }

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }
    private var radius: CGFloat { SoundfolioTheme.cornerRadius(from: preferences) }

    private var customRangeChip: some View {
        Button {
            prepareCustomDates()
            showCustomRange = true
        } label: {
            Text(preferences.customFrom.isEmpty ? "Custom" : "\(preferences.customFrom) – \(preferences.customTo)")
                .font(SoundfolioFont.medium(12))
                .padding(.horizontal, 10)
                .frame(minHeight: SoundfolioTheme.controlMinHeight - 8)
                .background(accent.opacity(0.15))
                .foregroundStyle(accent)
                .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var customButton: some View {
        Button {
            prepareCustomDates()
            showCustomRange = true
        } label: {
            Text("Custom")
                .font(SoundfolioFont.medium(12))
                .padding(.horizontal, 10)
                .frame(minHeight: SoundfolioTheme.controlMinHeight - 8)
                .background(SoundfolioTheme.mutedFill)
                .foregroundStyle(.primary)
                .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func periodChip(_ period: StatsPeriod) -> some View {
        let selected = !preferences.usesCustomRange && preferences.period == period
        return Button {
            preferences.customFrom = ""
            preferences.customTo = ""
            preferences.period = period
        } label: {
            Text(period.label)
                .font(SoundfolioFont.medium(12))
                .padding(.horizontal, 10)
                .frame(minHeight: SoundfolioTheme.controlMinHeight - 8)
                .background(selected ? accent.opacity(0.15) : SoundfolioTheme.mutedFill)
                .foregroundStyle(selected ? accent : .primary)
                .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var customRangeSheet: some View {
        NavigationStack {
            Form {
                DatePicker("From", selection: $customFromDate, displayedComponents: .date)
                DatePicker("To", selection: $customToDate, displayedComponents: .date)
            }
            .navigationTitle("Custom range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCustomRange = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") { applyCustomRange() }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func prepareCustomDates() {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = Calendar.current.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        if let from = formatter.date(from: preferences.customFrom) {
            customFromDate = from
        }
        if let to = formatter.date(from: preferences.customTo) {
            customToDate = to
        }
    }

    private func applyCustomRange() {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = Calendar.current.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let from = min(customFromDate, customToDate)
        let to = max(customFromDate, customToDate)
        preferences.customFrom = formatter.string(from: from)
        preferences.customTo = formatter.string(from: to)
        showCustomRange = false
    }
}

struct SortPicker: View {
    @Bindable var preferences: StatsPreferences

    var body: some View {
        SoundfolioSegmentedControl(
            title: "Rank by",
            options: TopSortMode.allCases.map { ($0, $0.label) },
            selection: $preferences.sort
        )
    }
}

struct MetricsGrid: View {
    @Environment(StatsPreferences.self) private var preferences
    let metrics: [OverviewMetric]
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var columns: [GridItem] {
        SoundfolioTheme.metricColumns(for: horizontalSizeClass)
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(metrics) { metric in
                StatCard(label: metric.label, value: metric.value, hint: metric.hint)
            }
        }
    }
}

struct SyncStatusLabel: View {
    let latestPlayAt: Date?
    let isSyncing: Bool

    var body: some View {
        HStack(spacing: 4) {
            if isSyncing {
                ProgressView()
                    .controlSize(.small)
            }
            Text(statusText)
                .font(SoundfolioTheme.captionFont)
                .foregroundStyle(SoundfolioTheme.mutedForeground)
                .lineLimit(1)
        }
    }

    private var statusText: String {
        if isSyncing { return "Syncing…" }
        guard let latestPlayAt else { return "No plays" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: latestPlayAt, relativeTo: Date())
    }
}
