import SwiftUI

/// Period chips + sort control in one compact row.
struct StatsFiltersBar: View {
    @Bindable var preferences: StatsPreferences

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            PeriodPicker(preferences: preferences)
            SortPicker(preferences: preferences)
        }
    }
}
