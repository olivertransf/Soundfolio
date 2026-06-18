import SwiftUI

enum AppTab: String, CaseIterable, Hashable {
    case dashboard
    case library
    case settings

    var title: String {
        switch self {
        case .dashboard: "Dashboard"
        case .library: "Library"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .dashboard: "chart.bar.fill"
        case .library: "books.vertical.fill"
        case .settings: "gearshape.fill"
        }
    }
}

enum LibrarySection: String, CaseIterable, Identifiable {
    case recent
    case rankings
    case patterns

    var id: String { rawValue }

    var title: String {
        switch self {
        case .recent: "Recent"
        case .rankings: "Rankings"
        case .patterns: "Patterns"
        }
    }

    var systemImage: String {
        switch self {
        case .recent: "clock.arrow.circlepath"
        case .rankings: "list.number"
        case .patterns: "chart.bar.xaxis"
        }
    }
}

@Observable
final class AppNavigation {
    var selectedTab: AppTab = .dashboard
    var librarySection: LibrarySection = .recent

    func openLibrary(_ section: LibrarySection) {
        librarySection = section
        selectedTab = .library
    }
}
