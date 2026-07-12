import SwiftUI

struct SyncToolbarButton: View {
    @Environment(AppState.self) private var appState
    @State private var syncError: String?
    @State private var showRecentResult = false

    private var accent: Color {
        SoundfolioTheme.accent(from: appState.preferences)
    }

    var body: some View {
        Button {
            Task { await sync() }
        } label: {
            HStack(spacing: 6) {
                statusIcon
                    .font(.caption.weight(.bold))
                    .frame(width: 14, height: 14)
                Text(statusText)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .contentTransition(.numericText())
            }
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(buttonBackground, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(borderColor)
            }
            .animation(.easeInOut(duration: 0.2), value: appState.isSyncing)
            .animation(.easeInOut(duration: 0.2), value: appState.syncSavedCount)
            .animation(.easeInOut(duration: 0.2), value: appState.syncPendingCount)
            .animation(.easeInOut(duration: 0.2), value: showRecentResult)
        }
        .buttonStyle(.plain)
        .disabled(appState.isSyncing)
        .accessibilityLabel(accessibilityText)
        .alert("Sync failed", isPresented: Binding(
            get: { syncError != nil },
            set: { if !$0 { syncError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(syncError ?? "")
        }
        .onChange(of: appState.lastSyncResult?.date) { _, _ in
            flashRecentResult()
        }
    }

    @ViewBuilder
    private var statusIcon: some View {
        if appState.isSyncing {
            ProgressView()
                .controlSize(.small)
                .tint(foregroundColor)
        } else if showRecentResult, let result = appState.lastSyncResult {
            Image(systemName: resultIcon(for: result.kind))
        } else {
            Image(systemName: "arrow.triangle.2.circlepath")
        }
    }

    private var statusText: String {
        if appState.isSyncing {
            if appState.syncSavedCount > 0 {
                if appState.syncPendingCount > 0 {
                    return "Saved \(appState.syncSavedCount) · \(appState.syncPendingCount) left"
                }
                return "Saved \(appState.syncSavedCount)"
            }
            return appState.syncProgressMessage ?? "Syncing…"
        }
        if showRecentResult, let result = appState.lastSyncResult {
            return result.message
        }
        if let synced = appState.lastSyncedAt {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return "Synced \(formatter.localizedString(for: synced, relativeTo: Date()))"
        }
        return "Sync Last.fm"
    }

    private var accessibilityText: String {
        if appState.isSyncing {
            if appState.syncSavedCount > 0 {
                if appState.syncPendingCount > 0 {
                    return "Saved \(appState.syncSavedCount) scrobbles, \(appState.syncPendingCount) remaining"
                }
                return "Saved \(appState.syncSavedCount) scrobbles"
            }
            return appState.syncProgressMessage ?? "Syncing Last.fm"
        }
        if let result = appState.lastSyncResult {
            return result.message
        }
        return "Sync Last.fm now"
    }

    private var foregroundColor: Color {
        if appState.isSyncing { return .white }
        if showRecentResult, let result = appState.lastSyncResult {
            switch result.kind {
            case .added, .upToDate: return .white
            case .skipped: return .primary
            case .failed: return .white
            }
        }
        return .white
    }

    private var buttonBackground: some ShapeStyle {
        if appState.isSyncing {
            return AnyShapeStyle(accent.opacity(0.82))
        }
        if showRecentResult, let result = appState.lastSyncResult {
            switch result.kind {
            case .added:
                return AnyShapeStyle(Color.green.gradient)
            case .upToDate:
                return AnyShapeStyle(accent.opacity(0.88))
            case .skipped:
                return AnyShapeStyle(Color.secondary.opacity(0.22))
            case .failed:
                return AnyShapeStyle(Color.red.gradient)
            }
        }
        return AnyShapeStyle(accent.gradient)
    }

    private var borderColor: Color {
        if showRecentResult, appState.lastSyncResult?.kind == .skipped {
            return Color.primary.opacity(0.12)
        }
        return Color.white.opacity(0.18)
    }

    private var shadowColor: Color {
        if appState.isSyncing { return accent.opacity(0.12) }
        if showRecentResult, appState.lastSyncResult?.kind == .failed {
            return Color.red.opacity(0.2)
        }
        return accent.opacity(0.24)
    }

    private func resultIcon(for kind: AppState.SyncResult.Kind) -> String {
        switch kind {
        case .added: return "checkmark.circle.fill"
        case .upToDate: return "checkmark"
        case .skipped: return "minus.circle"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }

    private func flashRecentResult() {
        guard appState.lastSyncResult != nil else { return }
        showRecentResult = true
        Task {
            try? await Task.sleep(for: .seconds(4))
            if !appState.isSyncing {
                showRecentResult = false
            }
        }
    }

    private func sync() async {
        showRecentResult = false
        do {
            _ = try await appState.syncLastFm()
        } catch {
            syncError = appState.handleError(error)
            showRecentResult = true
        }
    }
}

struct SyncStatusPanel: View {
    let isSyncing: Bool
    let progressMessage: String?
    let savedCount: Int
    let pendingCount: Int
    let lastResult: AppState.SyncResult?
    let lastSyncedAt: Date?
    let accent: Color
    let onSync: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onSync) {
                Label(buttonTitle, systemImage: "arrow.triangle.2.circlepath")
                    .symbolEffect(.rotate, isActive: isSyncing)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(isSyncing ? accent.opacity(0.85) : accent)
            .disabled(isSyncing)

            if isSyncing {
                HStack(spacing: 8) {
                    ProgressView()
                    VStack(alignment: .leading, spacing: 2) {
                        if savedCount > 0 {
                            Text(
                                pendingCount > 0
                                    ? "Saved \(savedCount) · \(pendingCount) remaining"
                                    : "Saved \(savedCount) scrobbles"
                            )
                            .font(.caption.weight(.medium))
                            .contentTransition(.numericText())
                        }
                        Text(progressMessage ?? "Syncing with Last.fm…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else if let lastResult {
                resultRow(lastResult)
            } else if let lastSyncedAt {
                Text("Last synced \(lastSyncedAt.formatted(.relative(presentation: .named)))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Pulls new scrobbles from Last.fm into your library.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var buttonTitle: String {
        isSyncing ? "Syncing…" : "Sync Last.fm"
    }

    @ViewBuilder
    private func resultRow(_ result: AppState.SyncResult) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: resultIcon(for: result.kind))
                .foregroundStyle(resultColor(for: result.kind))
            VStack(alignment: .leading, spacing: 2) {
                Text(result.message)
                    .font(.caption.weight(.medium))
                Text(result.date.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func resultIcon(for kind: AppState.SyncResult.Kind) -> String {
        switch kind {
        case .added: return "checkmark.circle.fill"
        case .upToDate: return "checkmark.circle"
        case .skipped: return "minus.circle"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }

    private func resultColor(for kind: AppState.SyncResult.Kind) -> Color {
        switch kind {
        case .added, .upToDate: return .green
        case .skipped: return .secondary
        case .failed: return .red
        }
    }
}
