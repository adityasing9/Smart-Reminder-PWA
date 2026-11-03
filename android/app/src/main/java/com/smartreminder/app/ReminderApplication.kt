package com.smartreminder.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.smartreminder.app.util.AlarmScheduler
import com.smartreminder.app.util.ThemeManager

class ReminderApplication : Application() {

    companion object {
        const val ALARM_CHANNEL_ID = "smart_reminder_alarm_v1"
        const val NOTIFICATION_ALERT_CHANNEL_ID = "smart_reminder_notification_alert_v1"
        const val GENERAL_CHANNEL_ID = "smart_reminder_general_v1"
    }

    override fun onCreate() {
        super.onCreate()
        // Initialize Theme from SharedPreferences
        ThemeManager.initTheme(this)

        createNotificationChannels()
        // Reschedule any alarms in case device was off or app updated
        AlarmScheduler.rescheduleAllAlarms(this)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. High-Priority Alarm Channel with Alarm Audio Attributes (for full ringing alarms)
            val alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val alarmAudioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()

            val alarmChannel = NotificationChannel(
                ALARM_CHANNEL_ID,
                "Ringing Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical audible alarms and full-screen alerts for scheduled reminders"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setSound(alarmSoundUri, alarmAudioAttributes)
                enableLights(true)
                lockscreenVisibility = NotificationManager.IMPORTANCE_HIGH
                setBypassDnd(true)
            }
            notificationManager.createNotificationChannel(alarmChannel)

            // 2. High-Priority Heads-Up Channel (for notification-only reminders)
            val notificationAudioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build()

            val notifChannel = NotificationChannel(
                NOTIFICATION_ALERT_CHANNEL_ID,
                "Notification Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Standard heads-up notification chime and banner without full-screen alarm takeover"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 150, 300)
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), notificationAudioAttributes)
                enableLights(true)
                lockscreenVisibility = NotificationManager.IMPORTANCE_HIGH
            }
            notificationManager.createNotificationChannel(notifChannel)

            // 3. Standard Channel for general alerts / update checks
            val generalChannel = NotificationChannel(
                GENERAL_CHANNEL_ID,
                "General App Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Updates, sync, and general notifications"
            }
            notificationManager.createNotificationChannel(generalChannel)
        }
    }
}
