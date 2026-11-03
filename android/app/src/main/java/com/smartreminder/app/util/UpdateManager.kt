package com.smartreminder.app.util

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

object UpdateManager {

    private const val GITHUB_REPO = "adityasing9/Smart-Reminder-PWA"
    private const val RELEASES_API = "https://api.github.com/repos/$GITHUB_REPO/releases/latest"

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
                    val tagName = json.optString("tag_name", "").replace("v", "").trim()
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
                                break
                            }
                        }
                    }

                    val currentVersion = getCurrentVersion(context)

                    withContext(Dispatchers.Main) {
                        if (isNewerVersion(tagName, currentVersion) && apkDownloadUrl.isNotBlank()) {
                            showUpdateDialog(context, tagName, releaseName, releaseBody, apkDownloadUrl)
                        } else if (isManualCheck) {
                            Toast.makeText(context, "You're using the latest version (v$currentVersion)", Toast.LENGTH_LONG).show()
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

    private fun getCurrentVersion(context: Context): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "2.0.0"
        } catch (e: Exception) {
            "2.0.0"
        }
    }

    private fun isNewerVersion(remote: String, current: String): Boolean {
        val rParts = remote.split(".").map { it.toIntOrNull() ?: 0 }
        val cParts = current.split(".").map { it.toIntOrNull() ?: 0 }
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
            .setMessage("$name\n\n$notes")
            .setPositiveButton("Download & Install") { _, _ ->
                downloadAndInstallApk(context, newVersion, apkUrl)
            }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun downloadAndInstallApk(context: Context, version: String, apkUrl: String) {
        try {
            val filename = "SmartReminder-v$version.apk"
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

            val request = DownloadManager.Request(Uri.parse(apkUrl)).apply {
                setTitle("Downloading Smart Reminder v$version")
                setDescription("Smart Reminder update package")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, filename)
            }

            val downloadId = downloadManager.enqueue(request)
            Toast.makeText(context, "Download started... You'll be prompted to install once complete.", Toast.LENGTH_LONG).show()

            // Listen for download completion
            val onComplete = object : BroadcastReceiver() {
                override fun onReceive(ctxt: Context, intent: Intent) {
                    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id == downloadId) {
                        ctxt.unregisterReceiver(this)
                        promptInstall(ctxt, filename)
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(
                    onComplete,
                    IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_NOT_EXPORTED
                )
            } else {
                context.registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
            }

        } catch (e: Exception) {
            Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun promptInstall(context: Context, filename: String) {
        try {
            val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename)
            if (file.exists()) {
                val apkUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                }
                context.startActivity(installIntent)
            }
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open installer: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}
