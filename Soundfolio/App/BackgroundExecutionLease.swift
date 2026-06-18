#if canImport(UIKit)
import UIKit

/// Keeps async work alive briefly after the app moves to the background.
@MainActor
final class BackgroundExecutionLease {
    private let name: String
    private var taskID: UIBackgroundTaskIdentifier = .invalid
    private var shouldKeepRunning = false

    init(name: String) {
        self.name = name
    }

    func begin() {
        shouldKeepRunning = true
        acquire()
    }

    func renew() {
        guard shouldKeepRunning else { return }
        acquire()
    }

    func end() {
        shouldKeepRunning = false
        let id = taskID
        taskID = .invalid
        if id != .invalid {
            UIApplication.shared.endBackgroundTask(id)
        }
    }

    private func acquire() {
        if taskID != .invalid {
            UIApplication.shared.endBackgroundTask(taskID)
            taskID = .invalid
        }
        taskID = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
            guard let self else { return }
            Task { @MainActor in
                self.handleExpiration()
            }
        }
    }

    private func handleExpiration() {
        let expiredID = taskID
        taskID = .invalid
        if expiredID != .invalid {
            UIApplication.shared.endBackgroundTask(expiredID)
        }
        guard shouldKeepRunning else { return }
        acquire()
    }
}

@MainActor
enum SyncBackgroundSession {
  private static let lease = BackgroundExecutionLease(name: "LastFmSync")

  static func begin() {
    lease.begin()
  }

  static func renew() {
    lease.renew()
  }

  static func end() {
    lease.end()
  }
}
#else
@MainActor
enum SyncBackgroundSession {
  static func begin() {}
  static func renew() {}
  static func end() {}
}
#endif
