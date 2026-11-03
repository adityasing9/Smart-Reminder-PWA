package com.smartreminder.app.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.receiver.AlarmReceiver
import com.smartreminder.app.ui.MainActivity

object AlarmScheduler {

    private const val TAG = "AlarmScheduler"
    const val ACTION_ALARM_TRIGGER = "com.smartreminder.app.ALARM_TRIGGER"
    const val EXTRA_REMINDER_ID = "REMINDER_ID"
    const val EXTRA_REMINDER_TITLE = "REMINDER_TITLE"
    const val EXTRA_REMINDER_DESC = "REMINDER_DESC"
    const val EXTRA_REMINDER_PRIORITY = "REMINDER_PRIORITY"
    const val EXTRA_REMINDER_CATEGORY = "REMINDER_CATEGORY"

    fun scheduleAlarm(context: Context, reminder: Reminder) {
        if (reminder.isCompleted) {
            cancelAlarm(context, reminder.id)
            return
        }

        val triggerTime = reminder.triggerTimeMillis
        val now = System.currentTimeMillis()

        if (triggerTime <= now) {
            Log.d(TAG, "Trigger time is in the past for reminder #${reminder.id}, skipping.")
            return
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_ALARM_TRIGGER
            putExtra(EXTRA_REMINDER_ID, reminder.id)
            putExtra(EXTRA_REMINDER_TITLE, reminder.title)
            putExtra(EXTRA_REMINDER_DESC, reminder.description)
            putExtra(EXTRA_REMINDER_PRIORITY, reminder.priority)
            putExtra(EXTRA_REMINDER_CATEGORY, reminder.category)
        }

        val requestCode = (reminder.id % 2000000000).toInt()
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

        // Show Intent for AlarmClockInfo (tapping status bar clock opens MainActivity)
        val showIntent = Intent(context, MainActivity::class.java)
        val showPendingIntent = PendingIntent.getActivity(
            context, requestCode, showIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        try {
            // Priority 1: setAlarmClock (Exempt from Doze, battery saver, and app standby)
            val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTime, showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            Log.d(TAG, "Successfully set exact AlarmClock for reminder #${reminder.id} at $triggerTime")
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm permission missing, falling back to setExactAndAllowWhileIdle", e)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            } catch (ex: Exception) {
                Log.e(TAG, "Failed to schedule alarm via fallback", ex)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm clock", e)
        }
    }

    fun cancelAlarm(context: Context, reminderId: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_ALARM_TRIGGER
        }
        val requestCode = (reminderId % 2000000000).toInt()
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
        Log.d(TAG, "Cancelled alarm for reminder #$reminderId")
    }

    fun scheduleTestAlarm(context: Context, delaySeconds: Int = 5) {
        val triggerTime = System.currentTimeMillis() + (delaySeconds * 1000)
        val testReminder = Reminder(
            id = 999999L,
            title = "🔔 Test Reminder Alert!",
            description = "High-priority alarm and audio chime are firing in real-time!",
            triggerTimeMillis = triggerTime,
            priority = "HIGH",
            category = "General"
        )
        scheduleAlarm(context, testReminder)
        Log.d(TAG, "Scheduled test alarm for $delaySeconds seconds from now.")
    }

    fun rescheduleAllAlarms(context: Context) {
        try {
            val db = ReminderDbHelper.getInstance(context)
            val upcoming = db.getUpcomingReminders()
            Log.d(TAG, "Rescheduling ${upcoming.size} upcoming reminders...")
            for (reminder in upcoming) {
                scheduleAlarm(context, reminder)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reschedule alarms", e)
        }
    }
}
