package com.smartreminder.app.ui

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.RotateAnimation
import androidx.appcompat.app.AppCompatActivity
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.databinding.ActivityAlarmAlertBinding
import com.smartreminder.app.service.AlarmSoundService
import com.smartreminder.app.util.AlarmScheduler
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AlarmAlertActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAlarmAlertBinding
    private var reminderId: Long = -1L
    private var reminderTitle: String = ""
    private var reminderDesc: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        wakeAndUnlockScreen()

        binding = ActivityAlarmAlertBinding.inflate(layoutInflater)
        setContentView(binding.root)

        reminderId = intent.getLongExtra(AlarmSoundService.EXTRA_REMINDER_ID, -1L)
        reminderTitle = intent.getStringExtra(AlarmSoundService.EXTRA_TITLE) ?: "Reminder Alert!"
        reminderDesc = intent.getStringExtra(AlarmSoundService.EXTRA_DESC) ?: ""

        setupUI()
        setupListeners()
        startBellAnimation()
    }

    private fun wakeAndUnlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun setupUI() {
        val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        binding.tvCurrentTime.text = timeFormat.format(Date())

        binding.tvAlarmTitle.text = reminderTitle
        if (reminderDesc.isNotBlank()) {
            binding.tvAlarmDesc.text = reminderDesc
            binding.tvAlarmDesc.visibility = android.view.View.VISIBLE
        } else {
            binding.tvAlarmDesc.text = "It's time for your scheduled reminder!"
        }
    }

    private fun setupListeners() {
        binding.btnDismiss.setOnClickListener {
            // Stop sound & vibration
            AlarmSoundService.stopAlarm(this)

            if (reminderId > 0 && reminderId != 999999L) {
                val db = ReminderDbHelper.getInstance(this)
                val updated = db.toggleComplete(reminderId)
                if (updated != null && !updated.isCompleted) {
                    // Recurring reminder rolled over, reschedule it
                    AlarmScheduler.scheduleAlarm(this, updated)
                }
            }
            finish()
        }

        binding.btnSnooze.setOnClickListener {
            // Stop sound & vibration
            AlarmSoundService.stopAlarm(this)

            // Snooze for 10 minutes
            val snoozeTime = System.currentTimeMillis() + (10 * 60 * 1000)
            val snoozedReminder = Reminder(
                id = if (reminderId > 0) reminderId else 999999L,
                title = "⏰ [Snoozed] $reminderTitle",
                description = reminderDesc,
                triggerTimeMillis = snoozeTime,
                priority = "HIGH"
            )
            AlarmScheduler.scheduleAlarm(this, snoozedReminder)
            finish()
        }
    }

    private fun startBellAnimation() {
        val rotate = RotateAnimation(
            -18f, 18f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.2f
        ).apply {
            duration = 180
            repeatMode = Animation.REVERSE
            repeatCount = Animation.INFINITE
        }
        binding.ivAlarmBell.startAnimation(rotate)
    }

    override fun onDestroy() {
        binding.ivAlarmBell.clearAnimation()
        super.onDestroy()
    }
}
