import SwiftUI

struct PeriodPicker: View {
    @Bindable var preferences: StatsPreferences
    @State private var showCustomRange = false
    @State private var customFromDate = Date()
    @State private var customToDate = Date()

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
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
        .sheet(isPresented: $showCustomRange) {
            customRangeSheet
        }
    }

    private var customRangeChip: some View {
        Button {
            prepareCustomDates()
            showCustomRange = true
        } label: {
            Text(preferences.customFrom.isEmpty ? "Custom" : "\(preferences.customFrom) – \(preferences.customTo)")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(SoundfolioTheme.accent(from: preferences).opacity(0.18))
                .foregroundStyle(SoundfolioTheme.accent(from: preferences))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var customButton: some View {
        Button {
            prepareCustomDates()
            showCustomRange = true
        } label: {
            Text("Custom")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(.tertiarySystemFill))
                .foregroundStyle(.primary)
                .clipShape(Capsule())
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
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(selected ? SoundfolioTheme.accent(from: preferences).opacity(0.18) : Color(.tertiarySystemFill))
                .foregroundStyle(selected ? SoundfolioTheme.accent(from: preferences) : .primary)
                .clipShape(Capsule())
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
        Picker("Rank by", selection: $preferences.sort) {
            ForEach(TopSortMode.allCases) { mode in
                Text(mode.label).tag(mode)
            }
        }
        .pickerStyle(.segmented)
    }
}

struct MetricsGrid: View {
    let metrics: [OverviewMetric]
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var columns: [GridItem] {
        let count = horizontalSizeClass == .regular ? 6 : 3
        return Array(repeating: GridItem(.flexible(), spacing: 6), count: count)
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(metrics) { metric in
                VStack(spacing: 2) {
                    Text(metric.label.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text(metric.value)
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if let hint = metric.hint {
                        Text(hint)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: SoundfolioTheme.metricCellHeight)
                .padding(.vertical, 6)
                .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                .font(.caption2)
                .foregroundStyle(.secondary)
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
