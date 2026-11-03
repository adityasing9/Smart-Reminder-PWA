package com.smartreminder.app.receiver

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.service.AlarmSoundService
import com.smartreminder.app.util.AlarmScheduler

class AlarmActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_DISMISS = "com.smartreminder.app.ACTION_DISMISS"
        const val ACTION_SNOOZE = "com.smartreminder.app.ACTION_SNOOZE"

        const val EXTRA_REMINDER_ID = "EXTRA_REMINDER_ID"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_DESC = "EXTRA_DESC"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getLongExtra(EXTRA_REMINDER_ID,
            intent.getLongExtra(AlarmScheduler.EXTRA_REMINDER_ID, -1L)
        )
        val title = intent.getStringExtra(EXTRA_TITLE)
            ?: intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_TITLE)
            ?: "Reminder"
        val desc = intent.getStringExtra(EXTRA_DESC)
            ?: intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_DESC)
            ?: ""

        Log.d("AlarmActionReceiver", "Action received: ${intent.action} for reminder #$reminderId")

        // 1. Immediately stop ringing and vibration if running
        AlarmSoundService.stopAlarm(context)

        // 2. Clear notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notifId = (reminderId % 2000000000).toInt() + 5000
        notificationManager.cancel(notifId)

        when (intent.action) {
            ACTION_DISMISS -> {
                if (reminderId > 0 && reminderId != 999999L) {
                    val db = ReminderDbHelper.getInstance(context)
                    val updated = db.toggleComplete(reminderId)
                    if (updated != null && !updated.isCompleted) {
                        // Recurring reminder rolled over to next date, reschedule it!
                        AlarmScheduler.scheduleAlarm(context, updated)
                    }
                }
            }

            ACTION_SNOOZE -> {
                // Snooze for 10 minutes
                val snoozeTime = System.currentTimeMillis() + (10 * 60 * 1000)
                val snoozedReminder = Reminder(
                    id = if (reminderId > 0) reminderId else 999999L,
                    title = "⏰ [Snoozed] $title",
                    description = desc,
                    triggerTimeMillis = snoozeTime,
                    priority = "HIGH"
                )
                AlarmScheduler.scheduleAlarm(context, snoozedReminder)
                Log.d("AlarmActionReceiver", "Reminder #$reminderId snoozed for 10 minutes.")
            }
        }
    }
}
