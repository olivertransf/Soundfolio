import SwiftUI

struct SoundfolioSegmentedControl<Option: Hashable>: View {
    @Environment(StatsPreferences.self) private var preferences

    let title: String?
    let options: [(Option, String)]
    @Binding var selection: Option

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title.uppercased())
                    .font(SoundfolioTheme.labelFont)
                    .tracking(0.6)
                    .foregroundStyle(SoundfolioTheme.mutedForeground)
            }
            HStack(spacing: 4) {
                ForEach(options, id: \.0) { option, label in
                    let selected = selection == option
                    Button {
                        selection = option
                    } label: {
                        Text(label)
                            .font(SoundfolioFont.medium(12))
                            .foregroundStyle(selected ? SoundfolioTheme.accent(from: preferences) : .primary)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: SoundfolioTheme.controlMinHeight - 8)
                            .padding(.horizontal, 8)
                            .background(
                                selected
                                    ? SoundfolioTheme.accent(from: preferences).opacity(0.15)
                                    : Color.clear
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .background(
                SoundfolioTheme.pageBackground,
                in: RoundedRectangle(cornerRadius: SoundfolioTheme.cornerRadius(from: preferences), style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: SoundfolioTheme.cornerRadius(from: preferences), style: .continuous)
                    .strokeBorder(SoundfolioTheme.border, lineWidth: 1)
            }
        }
    }
}

struct FilterToolbar: View {
    @Bindable var preferences: StatsPreferences
    let context: FilterToolbarContext
    @Binding var recentUsesPeriodFilter: Bool

    init(preferences: StatsPreferences, context: FilterToolbarContext, recentUsesPeriodFilter: Binding<Bool> = .constant(false)) {
        self.preferences = preferences
        self.context = context
        _recentUsesPeriodFilter = recentUsesPeriodFilter
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PeriodPicker(preferences: preferences)
            switch context {
            case .dashboard, .rankings:
                SortPicker(preferences: preferences)
            case .patterns:
                EmptyView()
            case .recent:
                Toggle(isOn: $recentUsesPeriodFilter) {
                    Text("Limit to selected period")
                        .font(SoundfolioTheme.rowSubtitleFont)
                }
                .tint(SoundfolioTheme.accent(from: preferences))
            }
        }
        .soundfolioPanel(preferences: preferences)
    }
}

enum FilterToolbarContext {
    case dashboard
    case rankings
    case patterns
    case recent
}
