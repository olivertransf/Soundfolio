import SwiftUI

enum FilterToolbarContext {
    case dashboard
    case rankings
    case patterns
    case recent
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
        VStack(alignment: .leading, spacing: 8) {
            PeriodPicker(preferences: preferences)
            switch context {
            case .dashboard, .rankings:
                SortPicker(preferences: preferences)
            case .patterns:
                EmptyView()
            case .recent:
                Toggle("Limit to selected period", isOn: $recentUsesPeriodFilter)
                    .font(.subheadline)
            }
        }
    }
}
