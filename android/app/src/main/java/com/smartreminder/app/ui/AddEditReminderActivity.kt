package com.smartreminder.app.ui

import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.smartreminder.app.R
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.databinding.ActivityAddEditReminderBinding
import com.smartreminder.app.util.AlarmScheduler
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class AddEditReminderActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_REMINDER_ID = "EXTRA_REMINDER_ID"
    }

    private lateinit var binding: ActivityAddEditReminderBinding
    private val calendar = Calendar.getInstance()
    private var reminderId: Long = -1L
    private var isEditMode = false

    private var selectedSoundUri: String? = null
    private var selectedSoundTitle: String = "Default Alarm Sound"
    private var previewPlayer: MediaPlayer? = null
    private var isPreviewPlaying = false

    private val soundPickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                val uri: Uri? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
                }

                if (uri != null) {
                    selectedSoundUri = uri.toString()
                    val ringtone = RingtoneManager.getRingtone(this, uri)
                    selectedSoundTitle = ringtone?.getTitle(this) ?: "Selected Sound"
                } else {
                    selectedSoundUri = null
                    selectedSoundTitle = "Silent"
                }
                binding.tvSoundTitle.text = selectedSoundTitle
                stopSoundPreview()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAddEditReminderBinding.inflate(layoutInflater)
        setContentView(binding.root)

        reminderId = intent.getLongExtra(EXTRA_REMINDER_ID, -1L)
        isEditMode = reminderId > 0

        setupToolbar()
        initDateTimeDefaults()
        setupDateTimePickers()
        setupShortcuts()
        setupSoundPicker()
        setupListeners()

        if (isEditMode) {
            loadExistingReminder(reminderId)
        }
    }

    private fun setupToolbar() {
        binding.toolbar.title = if (isEditMode) "Edit Reminder" else "New Reminder"
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun initDateTimeDefaults() {
        // Default: 1 hour from current time rounded to next 5 minutes
        calendar.timeInMillis = System.currentTimeMillis()
        calendar.add(Calendar.HOUR_OF_DAY, 1)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val minutes = calendar.get(Calendar.MINUTE)
        val remainder = minutes % 5
        if (remainder != 0) {
            calendar.add(Calendar.MINUTE, 5 - remainder)
        }
        updateDateTimeDisplay()
    }

    private fun updateDateTimeDisplay() {
        val dateFormat = SimpleDateFormat("EEE, MMM d, yyyy", Locale.getDefault())
        val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())

        binding.tvSelectedDate.text = dateFormat.format(calendar.time)
        binding.tvSelectedTime.text = timeFormat.format(calendar.time)
    }

    private fun setupDateTimePickers() {
        binding.cardDatePicker.setOnClickListener {
            val year = calendar.get(Calendar.YEAR)
            val month = calendar.get(Calendar.MONTH)
            val day = calendar.get(Calendar.DAY_OF_MONTH)

            DatePickerDialog(this, { _, selectedYear, selectedMonth, selectedDay ->
                calendar.set(Calendar.YEAR, selectedYear)
                calendar.set(Calendar.MONTH, selectedMonth)
                calendar.set(Calendar.DAY_OF_MONTH, selectedDay)
                updateDateTimeDisplay()
            }, year, month, day).show()
        }

        binding.cardTimePicker.setOnClickListener {
            val hour = calendar.get(Calendar.HOUR_OF_DAY)
            val minute = calendar.get(Calendar.MINUTE)

            TimePickerDialog(this, { _, selectedHour, selectedMinute ->
                calendar.set(Calendar.HOUR_OF_DAY, selectedHour)
                calendar.set(Calendar.MINUTE, selectedMinute)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
                updateDateTimeDisplay()
            }, hour, minute, false).show()
        }
    }

    private fun setupShortcuts() {
        binding.btnShortcut10Mins.setOnClickListener {
            calendar.timeInMillis = System.currentTimeMillis()
            calendar.add(Calendar.MINUTE, 10)
            updateDateTimeDisplay()
        }

        binding.btnShortcut1Hour.setOnClickListener {
            calendar.timeInMillis = System.currentTimeMillis()
            calendar.add(Calendar.HOUR_OF_DAY, 1)
            updateDateTimeDisplay()
        }

        binding.btnShortcutTonight.setOnClickListener {
            calendar.timeInMillis = System.currentTimeMillis()
            calendar.set(Calendar.HOUR_OF_DAY, 20)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            if (calendar.timeInMillis <= System.currentTimeMillis()) {
                calendar.add(Calendar.DAY_OF_YEAR, 1)
            }
            updateDateTimeDisplay()
        }

        binding.btnShortcutTomorrow.setOnClickListener {
            calendar.timeInMillis = System.currentTimeMillis()
            calendar.add(Calendar.DAY_OF_YEAR, 1)
            calendar.set(Calendar.HOUR_OF_DAY, 9)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            updateDateTimeDisplay()
        }
    }

    private fun setupSoundPicker() {
        binding.tvSoundTitle.text = selectedSoundTitle

        val launchPicker = {
            val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL)
                putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Choose Reminder Sound")
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
                selectedSoundUri?.let {
                    putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(it))
                }
            }
            soundPickerLauncher.launch(intent)
        }

        binding.cardSoundPicker.setOnClickListener { launchPicker() }
        binding.btnChangeSound.setOnClickListener { launchPicker() }

        binding.btnPreviewSound.setOnClickListener {
            if (isPreviewPlaying) {
                stopSoundPreview()
            } else {
                startSoundPreview()
            }
        }
    }

    private fun startSoundPreview() {
        try {
            stopSoundPreview()
            val uri = if (!selectedSoundUri.isNullOrBlank()) {
                Uri.parse(selectedSoundUri)
            } else {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

            previewPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                prepare()
                start()
                setOnCompletionListener {
                    stopSoundPreview()
                }
            }
            isPreviewPlaying = true
            binding.btnPreviewSound.setIconResource(android.R.drawable.ic_media_pause)
        } catch (e: Exception) {
            Toast.makeText(this, "Could not play sound preview: ${e.message}", Toast.LENGTH_SHORT).show()
            stopSoundPreview()
        }
    }

    private fun stopSoundPreview() {
        try {
            previewPlayer?.stop()
            previewPlayer?.release()
            previewPlayer = null
        } catch (_: Exception) {}
        isPreviewPlaying = false
        binding.btnPreviewSound.setIconResource(android.R.drawable.ic_media_play)
    }

    private fun setupListeners() {
        binding.btnSaveReminder.setOnClickListener {
            saveReminder()
        }
    }

    private fun loadExistingReminder(id: Long) {
        val db = ReminderDbHelper.getInstance(this)
        val reminder = db.getReminderById(id) ?: return

        binding.etTitle.setText(reminder.title)
        binding.etDescription.setText(reminder.description)
        calendar.timeInMillis = reminder.triggerTimeMillis
        updateDateTimeDisplay()

        // Sound
        selectedSoundUri = reminder.soundUri
        selectedSoundTitle = reminder.soundTitle
        binding.tvSoundTitle.text = selectedSoundTitle

        // Alert Type
        if (reminder.alertType.equals("NOTIFICATION", ignoreCase = true)) {
            binding.chipAlertNotification.isChecked = true
        } else {
            binding.chipAlertAlarm.isChecked = true
        }

        // Priority
        when (reminder.priority.uppercase()) {
            "HIGH" -> binding.chipPriorityHigh.isChecked = true
            "LOW" -> binding.chipPriorityLow.isChecked = true
            else -> binding.chipPriorityMedium.isChecked = true
        }

        // Repeat
        when (reminder.repeatType.uppercase()) {
            "DAILY" -> binding.chipRepeatDaily.isChecked = true
            "WEEKLY" -> binding.chipRepeatWeekly.isChecked = true
            "MONTHLY" -> binding.chipRepeatMonthly.isChecked = true
            else -> binding.chipRepeatNone.isChecked = true
        }

        // Category
        when (reminder.category) {
            "Event" -> binding.chipCatEvent.isChecked = true
            "Work" -> binding.chipCatWork.isChecked = true
            "Personal" -> binding.chipCatPersonal.isChecked = true
            "Meeting" -> binding.chipCatMeeting.isChecked = true
            "Birthday" -> binding.chipCatBirthday.isChecked = true
            "Health" -> binding.chipCatHealth.isChecked = true
            "Finance" -> binding.chipCatFinance.isChecked = true
            "Shopping" -> binding.chipCatShopping.isChecked = true
            "Study" -> binding.chipCatStudy.isChecked = true
            else -> binding.chipCatGeneral.isChecked = true
        }
    }

    private fun saveReminder() {
        stopSoundPreview()

        val title = binding.etTitle.text?.toString()?.trim() ?: ""
        val description = binding.etDescription.text?.toString()?.trim() ?: ""

        if (title.isBlank()) {
            binding.tilTitle.error = "Please enter a reminder title"
            return
        }
        binding.tilTitle.error = null

        val triggerTime = calendar.timeInMillis
        val now = System.currentTimeMillis()

        if (triggerTime <= now) {
            Toast.makeText(this, "Please select a future date and time for the alarm", Toast.LENGTH_LONG).show()
            return
        }

        // Determine Alert Type
        val alertType = if (binding.chipAlertNotification.isChecked) "NOTIFICATION" else "ALARM"

        // Determine Priority
        val priority = when {
            binding.chipPriorityHigh.isChecked -> "HIGH"
            binding.chipPriorityLow.isChecked -> "LOW"
            else -> "MEDIUM"
        }

        // Determine Category
        val category = when {
            binding.chipCatEvent.isChecked -> "Event"
            binding.chipCatWork.isChecked -> "Work"
            binding.chipCatPersonal.isChecked -> "Personal"
            binding.chipCatMeeting.isChecked -> "Meeting"
            binding.chipCatBirthday.isChecked -> "Birthday"
            binding.chipCatHealth.isChecked -> "Health"
            binding.chipCatFinance.isChecked -> "Finance"
            binding.chipCatShopping.isChecked -> "Shopping"
            binding.chipCatStudy.isChecked -> "Study"
            else -> "General"
        }

        // Determine Repeat
        val repeatType = when {
            binding.chipRepeatDaily.isChecked -> "DAILY"
            binding.chipRepeatWeekly.isChecked -> "WEEKLY"
            binding.chipRepeatMonthly.isChecked -> "MONTHLY"
            else -> "NONE"
        }

        val db = ReminderDbHelper.getInstance(this)

        if (isEditMode) {
            val updated = Reminder(
                id = reminderId,
                title = title,
                description = description,
                triggerTimeMillis = triggerTime,
                isCompleted = false,
                priority = priority,
                category = category,
                repeatType = repeatType,
                soundUri = selectedSoundUri,
                soundTitle = selectedSoundTitle,
                alertType = alertType
            )
            db.updateReminder(updated)
            AlarmScheduler.scheduleAlarm(this, updated)
            Toast.makeText(this, "Reminder updated & alarm set!", Toast.LENGTH_SHORT).show()
        } else {
            val newReminder = Reminder(
                title = title,
                description = description,
                triggerTimeMillis = triggerTime,
                isCompleted = false,
                priority = priority,
                category = category,
                repeatType = repeatType,
                soundUri = selectedSoundUri,
                soundTitle = selectedSoundTitle,
                alertType = alertType
            )
            val newId = db.insertReminder(newReminder)
            val reminderWithId = newReminder.copy(id = newId)
            AlarmScheduler.scheduleAlarm(this, reminderWithId)
            Toast.makeText(this, "Reminder created & alert scheduled!", Toast.LENGTH_SHORT).show()
        }

        finish()
    }

    override fun onStop() {
        super.onStop()
        stopSoundPreview()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopSoundPreview()
    }
}
