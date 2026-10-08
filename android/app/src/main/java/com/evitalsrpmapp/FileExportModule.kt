package com.evitalsrpmapp

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class FileExportModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod
  fun saveToDownloads(filename: String, mimeType: String, base64Data: String, promise: Promise) {
    try {
      val safeName = sanitizeFilename(filename)
      val bytes = Base64.decode(base64Data, Base64.DEFAULT)
      if (bytes.isEmpty()) {
        promise.reject("E_SAVE_FILE", "The export file is empty")
        return
      }
      val savedName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveWithMediaStore(safeName, mimeType, bytes)
      } else {
        saveLegacyDownloads(safeName, bytes)
      }
      promise.resolve(savedName)
    } catch (error: Exception) {
      promise.reject("E_SAVE_FILE", error.message, error)
    }
  }

  private fun sanitizeFilename(filename: String): String {
    val cleaned = filename.trim().replace(Regex("""[\\/:*?"<>|]"""), "_")
    if (!cleaned.contains('.')) {
      throw IllegalArgumentException("Export filename must include a file extension")
    }
    return cleaned
  }

  private fun saveWithMediaStore(filename: String, mimeType: String, bytes: ByteArray): String {
    val resolver = reactApplicationContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
      put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
      put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IllegalStateException("Could not create the download file")
    try {
      resolver.openOutputStream(uri)?.use { stream ->
        stream.write(bytes)
      } ?: throw IllegalStateException("Could not write the download file")
      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
    } catch (error: Exception) {
      resolver.delete(uri, null, null)
      throw error
    }
    return filename
  }

  private fun saveLegacyDownloads(filename: String, bytes: ByteArray): String {
    val directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    if (!directory.exists() && !directory.mkdirs()) {
      throw IllegalStateException("Could not open the Downloads folder")
    }
    val file = File(directory, filename)
    FileOutputStream(file).use { stream -> stream.write(bytes) }
    return file.name
  }

  companion object {
    const val NAME = "FileExport"
  }
}
