package com.smartreminder.app.util

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.smartreminder.app.R
import com.smartreminder.app.ReminderApplication
import com.smartreminder.app.receiver.AlarmActionReceiver
import com.smartreminder.app.ui.MainActivity

object NotificationAlertHelper {

    private const val TAG = "NotificationAlertHelper"

    fun showNotificationAlert(
        context: Context,
        reminderId: Long,
        title: String,
        desc: String,
        priority: String,
        category: String,
        soundUri: String?
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = (reminderId % 2000000000).toInt() + 5000

        // 1. Play one-time sound
        playOneTimeSound(context, soundUri)

        // 2. Vibrate once
        playOneTimeVibration(context)

        // Content Intent (tapping notification opens MainActivity)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            openIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Dismiss / Mark Done Action
        val doneIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = AlarmActionReceiver.ACTION_DISMISS
            putExtra(AlarmActionReceiver.EXTRA_REMINDER_ID, reminderId)
        }
        val donePendingIntent = PendingIntent.getBroadcast(
            context,
            notifId + 1,
            doneIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Snooze Action (+10m)
        val snoozeIntent = Intent(context, AlarmActionReceiver::class.java).apply {
            action = AlarmActionReceiver.ACTION_SNOOZE
            putExtra(AlarmActionReceiver.EXTRA_REMINDER_ID, reminderId)
            putExtra(AlarmActionReceiver.EXTRA_TITLE, title)
            putExtra(AlarmActionReceiver.EXTRA_DESC, desc)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            notifId + 2,
            snoozeIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val priorityEmoji = when (priority.uppercase()) {
            "HIGH" -> "🚨 "
            "LOW" -> "ℹ️ "
            else -> "📌 "
        }

        val notification = NotificationCompat.Builder(context, ReminderApplication.NOTIFICATION_ALERT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle("$priorityEmoji$title")
            .setContentText(if (desc.isNotBlank()) desc else "Scheduled reminder alert")
            .setStyle(NotificationCompat.BigTextStyle().bigText(desc))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Mark Done", donePendingIntent)
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze (10m)", snoozePendingIntent)
            .build()

        notificationManager.notify(notifId, notification)
        Log.d(TAG, "Posted Notification-Only alert for reminder #$reminderId")
    }

    private fun playOneTimeSound(context: Context, soundUri: String?) {
        try {
            var alertUri: Uri? = null
            if (!soundUri.isNullOrBlank()) {
                try {
                    alertUri = Uri.parse(soundUri)
                } catch (e: Exception) {
                    Log.w(TAG, "Invalid sound URI: $soundUri", e)
                }
            }
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            }

            val player = MediaPlayer()
            try {
                player.setDataSource(context, alertUri!!)
            } catch (e: Exception) {
                val fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                player.setDataSource(context, fallbackUri)
            }
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.isLooping = false
            player.setOnCompletionListener { it.release() }
            player.prepare()
            player.start()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play one-time notification sound", e)
        }
    }

    private fun playOneTimeVibration(context: Context) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(400, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(400)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed one-time vibration", e)
        }
    }
}
