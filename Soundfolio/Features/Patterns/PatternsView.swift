import SwiftUI

struct PatternsView: View {
    @Environment(AppState.self) private var appState
    @Bindable var preferences: StatsPreferences
    @State private var data: PatternsResponse?
    @State private var loading = true
    @State private var error: String?

    private var accent: Color { SoundfolioTheme.accent(from: preferences) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SoundfolioTheme.sectionSpacing) {
                StatsFiltersBar(preferences: preferences)

                if loading {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                } else if let error {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 80)
                } else if let data {
                    patternCard(title: "By hour") {
                        SoundfolioBarChart(
                            points: data.byHour.map { ($0.label, Double($0.minutes)) },
                            labelStyle: .hourOfDay,
                            accent: accent
                        )
                    }
                    patternCard(title: "By weekday") {
                        SoundfolioBarChart(
                            points: data.byDay.map { ($0.label, Double($0.minutes)) },
                            labelStyle: .weekday,
                            accent: accent
                        )
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Heatmap")
                            .font(.subheadline.weight(.semibold))
                        ListeningHeatmapView(
                            grid: data.heatmap.grid,
                            dayNames: data.heatmap.dayNames,
                            accent: accent
                        )
                    }
                    .soundfolioCard()
                }
            }
            .soundfolioPage()
        }
        .navigationTitle("Patterns")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { await load() }
    }

    private var reloadID: String {
        "\(preferences.period.rawValue)-\(preferences.customFrom)-\(preferences.customTo)-\(preferences.baseURL)"
    }

    private func patternCard<Content: View>(title: String, @ViewBuilder chart: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            chart()
        }
        .soundfolioCard()
    }

    private func load() async {
        guard !preferences.baseURL.isEmpty else {
            loading = false
            error = APIClientError.missingBaseURL.localizedDescription
            return
        }
        loading = true
        error = nil
        appState.reloadClient()
        do {
            data = try await appState.client.fetchPatterns(query: preferences.makeQuery())
        } catch {
            self.error = appState.handleError(error)
        }
        loading = false
    }
}
