package com.smartreminder.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import com.smartreminder.app.util.AlarmScheduler

class ReminderApplication : Application() {

    companion object {
        const val ALARM_CHANNEL_ID = "smart_reminder_alarm_v1"
        const val GENERAL_CHANNEL_ID = "smart_reminder_general_v1"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        // Reschedule any alarms in case device was off or app updated
        AlarmScheduler.rescheduleAllAlarms(this)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. High-Priority Alarm Channel with Alarm Audio Attributes
            val alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()

            val alarmChannel = NotificationChannel(
                ALARM_CHANNEL_ID,
                "Reminders & Alarms (Ringing)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical audible alarms and full-screen alerts for scheduled reminders"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setSound(alarmSoundUri, audioAttributes)
                enableLights(true)
                lockscreenVisibility = NotificationManager.IMPORTANCE_HIGH
                setBypassDnd(true) // Allows alarm through Do Not Disturb
            }
            notificationManager.createNotificationChannel(alarmChannel)

            // 2. Standard Channel for general alerts / update checks
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
