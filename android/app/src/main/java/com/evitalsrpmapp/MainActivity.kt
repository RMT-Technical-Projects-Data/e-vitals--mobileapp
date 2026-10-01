package com.evitalsrpmapp

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.database.ContentObserver
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  private var autoRotateObserverRegistered = false

  private val autoRotateObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
    override fun onChange(selfChange: Boolean) {
      followSystemOrientationIfLocked()
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "evitals"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    registerAutoRotateObserver()
    followSystemOrientationIfLocked()
  }

  override fun onDestroy() {
    unregisterAutoRotateObserver()
    super.onDestroy()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    followSystemOrientationIfLocked()
  }

  /**
   * react-native-orientation-locker requests SENSOR and SENSOR_LANDSCAPE, which rotate the
   * activity even when system Auto-rotate is off. Honor that setting here so every caller is covered.
   */
  override fun setRequestedOrientation(requestedOrientation: Int) {
    val resolved = resolveOrientation(requestedOrientation)
    if (getRequestedOrientation() == resolved) {
      return
    }
    super.setRequestedOrientation(resolved)
  }

  private fun resolveOrientation(requestedOrientation: Int): Int {
    if (!isAutoRotateEnabled()) {
      return ActivityInfo.SCREEN_ORIENTATION_USER
    }

    // SENSOR follows the accelerometer and keeps doing so after Auto-rotate is turned off.
    // USER follows the sensor only while Auto-rotate is on.
    if (requestedOrientation == ActivityInfo.SCREEN_ORIENTATION_SENSOR) {
      return ActivityInfo.SCREEN_ORIENTATION_USER
    }

    return requestedOrientation
  }

  private fun followSystemOrientationIfLocked() {
    if (!isAutoRotateEnabled()) {
      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_USER
    }
  }

  private fun isAutoRotateEnabled(): Boolean {
    return try {
      Settings.System.getInt(
          contentResolver,
          Settings.System.ACCELEROMETER_ROTATION,
          0
      ) == 1
    } catch (_: SecurityException) {
      false
    }
  }

  private fun registerAutoRotateObserver() {
    if (autoRotateObserverRegistered) {
      return
    }
    contentResolver.registerContentObserver(
        Settings.System.getUriFor(Settings.System.ACCELEROMETER_ROTATION),
        false,
        autoRotateObserver
    )
    autoRotateObserverRegistered = true
  }

  private fun unregisterAutoRotateObserver() {
    if (!autoRotateObserverRegistered) {
      return
    }
    contentResolver.unregisterContentObserver(autoRotateObserver)
    autoRotateObserverRegistered = false
  }
}
