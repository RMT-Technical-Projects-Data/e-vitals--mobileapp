import UIKit
import UserNotifications
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    Orientation.getOrientation()
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "evitals",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Messaging.messaging().apnsToken = deviceToken
  }

  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    completionHandler(.newData)
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound, .badge])
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    if let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") {
      return url
    }

    // Fallback when Metro host discovery fails (common after device/simulator switches).
    #if targetEnvironment(simulator)
    return URL(string: "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false")
    #else
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #endif
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
