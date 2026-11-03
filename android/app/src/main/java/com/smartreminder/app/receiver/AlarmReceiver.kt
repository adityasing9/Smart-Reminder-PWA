package com.smartreminder.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.smartreminder.app.service.AlarmSoundService
import com.smartreminder.app.util.AlarmScheduler

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d("AlarmReceiver", "Alarm trigger received! Action: ${intent.action}")

        val reminderId = intent.getLongExtra(AlarmScheduler.EXTRA_REMINDER_ID, -1L)
        val title = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_TITLE) ?: "Reminder Alert!"
        val desc = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_DESC) ?: "It's time for your scheduled reminder."
        val priority = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_PRIORITY) ?: "MEDIUM"
        val category = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_CATEGORY) ?: "General"

        // Acquire WakeLock to ensure device stays awake while starting alarm service
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "SmartReminder:AlarmWakeLock"
        )
        wakeLock.acquire(15000) // 15 seconds safety timeout

        try {
            // Start foreground sound and notification service
            AlarmSoundService.startAlarm(context, reminderId, title, desc, priority, category)
        } catch (e: Exception) {
            Log.e("AlarmReceiver", "Failed to start AlarmSoundService", e)
        } finally {
            if (wakeLock.isHeld) {
                wakeLock.release()
            }
        }
    }
}
