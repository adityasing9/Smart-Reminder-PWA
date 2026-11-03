package com.smartreminder.app.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.smartreminder.app.R
import com.smartreminder.app.ReminderApplication
import com.smartreminder.app.receiver.AlarmActionReceiver
import com.smartreminder.app.ui.AlarmAlertActivity

class AlarmSoundService : Service() {

    companion object {
        private const val TAG = "AlarmSoundService"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_START_ALARM = "ACTION_START_ALARM"
        const val ACTION_STOP_ALARM = "ACTION_STOP_ALARM"

        const val EXTRA_REMINDER_ID = "EXTRA_REMINDER_ID"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_DESC = "EXTRA_DESC"
        const val EXTRA_PRIORITY = "EXTRA_PRIORITY"
        const val EXTRA_CATEGORY = "EXTRA_CATEGORY"

        fun startAlarm(context: Context, id: Long, title: String, desc: String, priority: String, category: String) {
            val intent = Intent(context, AlarmSoundService::class.java).apply {
                action = ACTION_START_ALARM
                putExtra(EXTRA_REMINDER_ID, id)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_DESC, desc)
                putExtra(EXTRA_PRIORITY, priority)
                putExtra(EXTRA_CATEGORY, category)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopAlarm(context: Context) {
            val intent = Intent(context, AlarmSoundService::class.java).apply {
                action = ACTION_STOP_ALARM
            }
            context.startService(intent)
        }
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null || intent.action == ACTION_STOP_ALARM) {
            stopSelfAndCleanup()
            return START_NOT_STICKY
        }

        if (intent.action == ACTION_START_ALARM) {
            val reminderId = intent.getLongExtra(EXTRA_REMINDER_ID, -1L)
            val title = intent.getStringExtra(EXTRA_TITLE) ?: "Reminder Alert!"
            val desc = intent.getStringExtra(EXTRA_DESC) ?: "It's time for your scheduled reminder."
            val priority = intent.getStringExtra(EXTRA_PRIORITY) ?: "MEDIUM"

            startRingingAndVibration()
            val notification = buildAlarmNotification(reminderId, title, desc, priority)
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_NOT_STICKY
    }

    private fun startRingingAndVibration() {
        // 1. Play Alarm Audio via MediaPlayer with USAGE_ALARM
        try {
            var alertUri: Uri? = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            }
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alertUri!!)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start alarm audio playback", e)
        }

        // 2. Vibration
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 800, 400, 800, 400, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 means repeat
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start vibration", e)
        }
    }

    private fun buildAlarmNotification(reminderId: Long, title: String, desc: String, priority: String): Notification {
        // Full screen intent to launch AlarmAlertActivity
        val fullScreenIntent = Intent(this, AlarmAlertActivity::class.java).apply {
            putExtra(EXTRA_REMINDER_ID, reminderId)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_DESC, desc)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            (reminderId % 2000000000).toInt(),
            fullScreenIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Dismiss Action
        val dismissIntent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = AlarmActionReceiver.ACTION_DISMISS
            putExtra(EXTRA_REMINDER_ID, reminderId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            (reminderId % 2000000000).toInt() + 100,
            dismissIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Snooze Action (+10 mins)
        val snoozeIntent = Intent(this, AlarmActionReceiver::class.java).apply {
            action = AlarmActionReceiver.ACTION_SNOOZE
            putExtra(EXTRA_REMINDER_ID, reminderId)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_DESC, desc)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            this,
            (reminderId % 2000000000).toInt() + 200,
            snoozeIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        val priorityEmoji = if (priority == "HIGH") "🚨 " else "⏰ "

        return NotificationCompat.Builder(this, ReminderApplication.ALARM_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle("$priorityEmoji$title")
            .setContentText(desc)
            .setStyle(NotificationCompat.BigTextStyle().bigText(desc))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze (10m)", snoozePendingIntent)
            .build()
    }

    private fun stopSelfAndCleanup() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping media player", e)
        }

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling vibration", e)
        }

        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        stopSelfAndCleanup()
        super.onDestroy()
    }
}
