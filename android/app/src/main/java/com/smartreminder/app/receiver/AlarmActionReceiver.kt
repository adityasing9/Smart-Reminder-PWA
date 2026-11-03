package com.smartreminder.app.receiver

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
    }

    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getLongExtra(AlarmScheduler.EXTRA_REMINDER_ID, -1L)
        val title = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_TITLE) ?: "Reminder"
        val desc = intent.getStringExtra(AlarmScheduler.EXTRA_REMINDER_DESC) ?: ""

        Log.d("AlarmActionReceiver", "Action received: ${intent.action} for reminder #$reminderId")

        // 1. Immediately stop ringing and vibration
        AlarmSoundService.stopAlarm(context)

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
