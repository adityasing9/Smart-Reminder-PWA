package com.smartreminder.app.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.smartreminder.app.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
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
                            // Prefer debug build if running a debug build or first apk found
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

                    withContext(Dispatchers.Main) {
                        val hasUpdate = isNewerVersion(tagName, currentVersion)
                        if (hasUpdate && apkDownloadUrl.isNotBlank()) {
                            showUpdateDialog(context, tagName, releaseName, releaseBody, apkDownloadUrl)
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
            .setMessage("$name\n\n$notes")
            .setPositiveButton("Download & Install") { _, _ ->
                downloadAndInstallApk(context, apkUrl)
            }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun downloadAndInstallApk(context: Context, apkUrl: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open download link: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}
