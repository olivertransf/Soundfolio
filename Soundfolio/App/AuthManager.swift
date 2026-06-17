import SwiftUI
import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif
#if canImport(UIKit)
import UIKit
#endif

@MainActor
@Observable
final class AuthManager {
    private(set) var user: FirebaseAuth.User?
    private(set) var isLoading = true
    private(set) var needsOnboarding = false
    private(set) var lastfmUsername: String?
    private(set) var lastError: String?

    private nonisolated(unsafe) var listener: AuthStateDidChangeListenerHandle?
    private var baseURLString = StatsPreferences.defaultBaseURL

    var isSignedIn: Bool { user != nil }

    init() {
        listener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.user = user
                if user != nil {
                    await self?.refreshProfile()
                    await self?.upsertProfile()
                } else {
                    self?.needsOnboarding = false
                    self?.lastfmUsername = nil
                    self?.isLoading = false
                }
            }
        }
    }

    func updateBaseURL(_ value: String) {
        baseURLString = value
    }

    func idToken(forceRefresh: Bool = false) async throws -> String? {
        try await user?.getIDToken(forcingRefresh: forceRefresh)
    }

    func refreshProfile() async {
        defer { isLoading = false }
        guard let uid = user?.uid else {
            needsOnboarding = false
            lastfmUsername = nil
            return
        }

        do {
            let snap = try await Firestore.firestore().collection("users").document(uid).getDocument()
            let username = (snap.data()?["lastfmUsername"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            lastfmUsername = username
            needsOnboarding = username?.isEmpty != false
        } catch {
            needsOnboarding = true
            lastfmUsername = nil
        }
    }

    private func upsertProfile() async {
        guard let user else { return }
        let ref = Firestore.firestore().collection("users").document(user.uid)
        do {
            let snap = try await ref.getDocument()
            let fields: [String: Any] = [
                "email": user.email as Any,
                "displayName": user.displayName as Any,
                "photoURL": user.photoURL?.absoluteString as Any,
                "updatedAt": FieldValue.serverTimestamp(),
                "lastSignInAt": FieldValue.serverTimestamp(),
            ]
            if snap.exists {
                try await ref.setData(fields, merge: true)
            } else {
                var create = fields
                create["lastfmUsername"] = NSNull()
                create["createdAt"] = FieldValue.serverTimestamp()
                try await ref.setData(create, merge: true)
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func signInWithGoogle() async throws {
        lastError = nil
        #if canImport(UIKit) && canImport(GoogleSignIn)
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthManagerError.missingGoogleClientID
        }
        guard let presenter = Self.topViewController() else {
            throw AuthManagerError.missingPresenter
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthManagerError.missingGoogleToken
        }

        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        _ = try await Auth.auth().signIn(with: credential)
        await refreshProfile()
        await upsertProfile()
        #else
        throw AuthManagerError.unsupportedPlatform
        #endif
    }

    func completeOnboarding(lastfmUsername: String) async throws {
        guard let uid = user?.uid else { throw AuthManagerError.notSignedIn }
        let trimmed = lastfmUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw AuthManagerError.server("Last.fm username is required.") }

        try await Firestore.firestore().collection("users").document(uid).setData([
            "lastfmUsername": trimmed,
            "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true)

        self.lastfmUsername = trimmed
        needsOnboarding = false
    }

    func signOut() throws {
        try Auth.auth().signOut()
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.signOut()
        #endif
        user = nil
        needsOnboarding = false
        lastfmUsername = nil
    }

    #if canImport(UIKit)
    private static func topViewController(base: UIViewController? = UIApplication.shared.connectedScenes
        .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
        .first) -> UIViewController? {
        if let nav = base as? UINavigationController {
            return topViewController(base: nav.visibleViewController)
        }
        if let tab = base as? UITabBarController, let selected = tab.selectedViewController {
            return topViewController(base: selected)
        }
        if let presented = base?.presentedViewController {
            return topViewController(base: presented)
        }
        return base
    }
    #endif
}

enum AuthManagerError: LocalizedError {
    case missingGoogleClientID
    case missingGoogleToken
    case missingPresenter
    case notSignedIn
    case invalidURL
    case unsupportedPlatform
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingGoogleClientID:
            "Google Sign-In is not configured for this app."
        case .missingGoogleToken:
            "Google did not return a sign-in token."
        case .missingPresenter:
            "Could not present Google Sign-In."
        case .notSignedIn:
            "Sign in to continue."
        case .invalidURL:
            "Server URL is invalid."
        case .unsupportedPlatform:
            "Sign-in is not supported on this platform."
        case .server(let message):
            message
        }
    }
}
