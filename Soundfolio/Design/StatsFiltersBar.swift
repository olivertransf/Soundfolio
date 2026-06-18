import SwiftUI

/// Backward-compatible alias for older call sites.
struct StatsFiltersBar: View {
    @Bindable var preferences: StatsPreferences

    var body: some View {
        FilterToolbar(preferences: preferences, context: .dashboard)
    }
}
