package com.smartreminder.app.util

import android.app.Activity
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.LayoutInflater
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.smartreminder.app.BuildConfig
import com.smartreminder.app.R
import com.smartreminder.app.ReminderApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

object UpdateManager {

    private const val GITHUB_REPO = "adityasing9/Smart-Reminder-PWA"
    private const val RELEASES_API = "https://api.github.com/repos/$GITHUB_REPO/releases/latest"

    private const val PREFS_NAME = "smart_reminder_updates"
    private const val KEY_AUTO_DOWNLOAD = "auto_download_updates"
    private const val KEY_PENDING_APK_PATH = "pending_apk_path"

    private var activeDownloadJob: Job? = null

    fun isAutoDownloadEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_AUTO_DOWNLOAD, true)
    }

    fun setAutoDownloadEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_AUTO_DOWNLOAD, enabled).apply()
    }

    private fun getPendingApkPath(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_PENDING_APK_PATH, null)
    }

    private fun setPendingApkPath(context: Context, path: String?) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_PENDING_APK_PATH, path).apply()
    }

    /**
     * Called from MainActivity.onResume to check if user just granted "Install unknown apps" permission.
     */
    fun checkPendingInstall(context: Context) {
        val pendingPath = getPendingApkPath(context) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (context.packageManager.canRequestPackageInstalls()) {
                val apkFile = File(pendingPath)
                if (apkFile.exists() && apkFile.length() > 500_000) {
                    setPendingApkPath(context, null)
                    installApk(context, apkFile)
                }
            }
        }
    }

    fun showUpdateSettingsDialog(context: Context) {
        val view = LayoutInflater.from(context).inflate(R.layout.dialog_update_settings, null)
        val switchAuto = view.findViewById<MaterialSwitch>(R.id.switchAutoDownload)
        val btnCheckNow = view.findViewById<MaterialButton>(R.id.btnCheckUpdatesNow)

        switchAuto.isChecked = isAutoDownloadEnabled(context)
        switchAuto.setOnCheckedChangeListener { _, isChecked ->
            setAutoDownloadEnabled(context, isChecked)
            Toast.makeText(context, if (isChecked) "Auto-download enabled" else "Auto-download disabled", Toast.LENGTH_SHORT).show()
        }

        val dialog = MaterialAlertDialogBuilder(context)
            .setView(view)
            .setPositiveButton("Done", null)
            .create()

        btnCheckNow.setOnClickListener {
            dialog.dismiss()
            checkForUpdates(context, isManualCheck = true)
        }

        dialog.show()
    }

    fun checkForUpdates(context: Context, isManualCheck: Boolean = false) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL(RELEASES_API)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json")
                conn.setRequestProperty("User-Agent", "SmartReminder-Android")
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val responseCode = conn.responseCode
                if (responseCode == 200) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val response = reader.readText()
                    reader.close()

                    val json = JSONObject(response)
                    val rawTag = json.optString("tag_name", "").trim()
                    val tagName = rawTag.replace("v", "").trim()
                    val releaseName = json.optString("name", "New Update")
                    val releaseBody = json.optString("body", "Bug fixes and improvements.")

                    var apkDownloadUrl = ""
                    val assets = json.optJSONArray("assets")
                    if (assets != null) {
                        for (i in 0 until assets.length()) {
                            val asset = assets.getJSONObject(i)
                            val name = asset.optString("name", "")
                            if (name.endsWith(".apk", ignoreCase = true)) {
                                apkDownloadUrl = asset.optString("browser_download_url", "")
                                if (BuildConfig.DEBUG && name.contains("debug", ignoreCase = true)) {
                                    break
                                } else if (!BuildConfig.DEBUG && !name.contains("debug", ignoreCase = true)) {
                                    break
                                }
                            }
                        }
                    }

                    val currentVersion = getCurrentVersion()
                    val hasUpdate = isNewerVersion(tagName, currentVersion)

                    withContext(Dispatchers.Main) {
                        if (hasUpdate && apkDownloadUrl.isNotBlank()) {
                            val updatesDir = File(context.cacheDir, "updates")
                            val downloadedApk = File(updatesDir, "SmartReminder-v$tagName.apk")

                            if (downloadedApk.exists() && downloadedApk.length() > 1_000_000) {
                                // Already downloaded! Offer immediate install
                                showReadyToInstallDialog(context, tagName, downloadedApk)
                            } else if (isAutoDownloadEnabled(context) && !isManualCheck) {
                                // Background auto-download
                                downloadUpdateInBackground(context, apkDownloadUrl, tagName)
                            } else {
                                // Show interactive update prompt
                                showUpdateDialog(context, tagName, releaseName, releaseBody, apkDownloadUrl)
                            }
                        } else if (isManualCheck) {
                            Toast.makeText(context, "Smart Reminder is up to date! (v$currentVersion)", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else if (isManualCheck) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Could not check updates. Status: $responseCode", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                if (isManualCheck) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Network error checking updates", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun getCurrentVersion(): String {
        return BuildConfig.VERSION_NAME
    }

    fun isNewerVersion(remoteTag: String, currentVer: String): Boolean {
        val cleanRemote = remoteTag.replace(Regex("[^0-9.]"), "").trim()
        val cleanCurrent = currentVer.replace(Regex("[^0-9.]"), "").trim()

        if (cleanRemote.isEmpty() || cleanRemote == cleanCurrent) {
            return false
        }

        val rParts = cleanRemote.split(".").filter { it.isNotEmpty() }.map { it.toIntOrNull() ?: 0 }
        val cParts = cleanCurrent.split(".").filter { it.isNotEmpty() }.map { it.toIntOrNull() ?: 0 }
        val maxLen = maxOf(rParts.size, cParts.size)

        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val c = cParts.getOrElse(i) { 0 }
            if (r > c) return true
            if (r < c) return false
        }
        return false
    }

    private fun showUpdateDialog(
        context: Context,
        newVersion: String,
        name: String,
        notes: String,
        apkUrl: String
    ) {
        MaterialAlertDialogBuilder(context)
            .setTitle("🚀 Update Available (v$newVersion)")
            .setMessage("$name\n\n$notes\n\nChoose 'Download & Install' to update directly within the app.")
            .setPositiveButton("⚡ Download & Install") { _, _ ->
                downloadAndInstallDirectly(context, apkUrl, newVersion)
            }
            .setNeutralButton("🌐 Browser") { _, _ ->
                openInBrowser(context, apkUrl)
            }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun showReadyToInstallDialog(context: Context, version: String, apkFile: File) {
        MaterialAlertDialogBuilder(context)
            .setTitle("📦 Update Ready to Install")
            .setMessage("Smart Reminder v$version has been downloaded and is ready to install.\n\nTap 'Install Now' to proceed.")
            .setPositiveButton("Install Now") { _, _ ->
                installApk(context, apkFile)
            }
            .setNegativeButton("Later", null)
            .show()
    }

    /**
     * Downloads the APK file directly with a progress dialog and opens the installer.
     */
    fun downloadAndInstallDirectly(context: Context, apkUrl: String, version: String) {
        val dialogView = LayoutInflater.from(context).inflate(R.layout.dialog_download_progress, null)
        val tvTitle = dialogView.findViewById<android.widget.TextView>(R.id.tvDownloadTitle)
        val tvSubtitle = dialogView.findViewById<android.widget.TextView>(R.id.tvDownloadSubtitle)
        val progressBar = dialogView.findViewById<LinearProgressIndicator>(R.id.progressBar)
        val tvProgressStatus = dialogView.findViewById<android.widget.TextView>(R.id.tvProgressStatus)

        tvTitle.text = "Downloading Update (v$version)..."
        tvSubtitle.text = "Please wait while Smart Reminder downloads the update APK."
        progressBar.isIndeterminate = false
        progressBar.progress = 0

        var progressDialog: AlertDialog? = null
        progressDialog = MaterialAlertDialogBuilder(context)
            .setView(dialogView)
            .setCancelable(false)
            .setNegativeButton("Cancel") { _, _ ->
                activeDownloadJob?.cancel()
                progressDialog?.dismiss()
                Toast.makeText(context, "Download cancelled", Toast.LENGTH_SHORT).show()
            }
            .show()

        activeDownloadJob = CoroutineScope(Dispatchers.IO).launch {
            try {
                val updatesDir = File(context.cacheDir, "updates")
                if (!updatesDir.exists()) updatesDir.mkdirs()
                val outputFile = File(updatesDir, "SmartReminder-v$version.apk")
                if (outputFile.exists()) outputFile.delete()

                val connection = openConnectionFollowingRedirects(apkUrl)
                val totalLength = connection.contentLength.toLong()
                val input: InputStream = connection.inputStream
                val output = FileOutputStream(outputFile)

                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalBytesRead: Long = 0
                var lastProgressUpdate = 0L

                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    totalBytesRead += bytesRead

                    val now = System.currentTimeMillis()
                    if (now - lastProgressUpdate > 100 || totalBytesRead == totalLength) {
                        lastProgressUpdate = now
                        val percent = if (totalLength > 0) ((totalBytesRead * 100) / totalLength).toInt() else 0
                        val mbRead = totalBytesRead / (1024.0 * 1024.0)
                        val mbTotal = if (totalLength > 0) totalLength / (1024.0 * 1024.0) else 0.0

                        withContext(Dispatchers.Main) {
                            progressBar.progress = percent
                            tvProgressStatus.text = String.format(
                                "%.1f MB / %.1f MB (%d%%)",
                                mbRead, mbTotal, percent
                            )
                        }
                    }
                }

                output.flush()
                output.close()
                input.close()

                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    Toast.makeText(context, "Download complete! Opening installer...", Toast.LENGTH_SHORT).show()
                    installApk(context, outputFile)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_LONG).show()
                    openInBrowser(context, apkUrl)
                }
            }
        }
    }

    /**
     * Background download without modal UI, notifies user when APK is ready.
     */
    private fun downloadUpdateInBackground(context: Context, apkUrl: String, version: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val updatesDir = File(context.cacheDir, "updates")
                if (!updatesDir.exists()) updatesDir.mkdirs()
                val outputFile = File(updatesDir, "SmartReminder-v$version.apk")
                if (outputFile.exists() && outputFile.length() > 1_000_000) return@launch

                val connection = openConnectionFollowingRedirects(apkUrl)
                val input: InputStream = connection.inputStream
                val output = FileOutputStream(outputFile)

                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                }
                output.flush()
                output.close()
                input.close()

                withContext(Dispatchers.Main) {
                    notifyUpdateReady(context, version, outputFile)
                }
            } catch (_: Exception) {}
        }
    }

    private fun notifyUpdateReady(context: Context, version: String, apkFile: File) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = 8888

        val apkUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            installIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, ReminderApplication.GENERAL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle("🚀 Smart Reminder v$version Ready")
            .setContentText("Update downloaded automatically. Tap to install now!")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(notifId, notification)
    }

    fun installApk(context: Context, apkFile: File) {
        if (!apkFile.exists()) {
            Toast.makeText(context, "Update file not found", Toast.LENGTH_SHORT).show()
            return
        }

        // On Android 8.0+, check if permission to install unknown apps is granted
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.packageManager.canRequestPackageInstalls()) {
                setPendingApkPath(context, apkFile.absolutePath)
                MaterialAlertDialogBuilder(context)
                    .setTitle("Permission Needed to Install")
                    .setMessage("To install this update, Android requires you to allow Smart Reminder to install unknown apps.\n\nPlease enable 'Allow from this source' on the settings screen that opens.")
                    .setPositiveButton("Open Settings") { _, _ ->
                        try {
                            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                                data = Uri.parse("package:${context.packageName}")
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            context.startActivity(Intent(Settings.ACTION_SETTINGS))
                        }
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
                return
            }
        }

        try {
            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open installer: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun openInBrowser(context: Context, apkUrl: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open download link: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun openConnectionFollowingRedirects(urlStr: String): HttpURLConnection {
        var currentUrl = urlStr
        var redirects = 0
        while (redirects < 6) {
            val url = URL(currentUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.setRequestProperty("User-Agent", "SmartReminder-Android")

            val status = connection.responseCode
            if (status == HttpURLConnection.HTTP_MOVED_TEMP ||
                status == HttpURLConnection.HTTP_MOVED_PERM ||
                status == HttpURLConnection.HTTP_SEE_OTHER ||
                status == 307 || status == 308
            ) {
                currentUrl = connection.getHeaderField("Location")
                connection.disconnect()
                redirects++
            } else {
                return connection
            }
        }
        throw java.io.IOException("Too many redirects: $redirects")
    }
}
