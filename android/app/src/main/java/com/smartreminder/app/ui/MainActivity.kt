package com.smartreminder.app.ui

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.smartreminder.app.BuildConfig
import com.smartreminder.app.R
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.databinding.ActivityMainBinding
import com.smartreminder.app.util.AlarmScheduler
import com.smartreminder.app.util.ThemeManager
import com.smartreminder.app.util.UpdateManager

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: ReminderAdapter
    private lateinit var db: ReminderDbHelper

    private val requestNotificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            if (isGranted) {
                Toast.makeText(this, "Notification permission granted!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Notifications are required for alarm alerts.", Toast.LENGTH_LONG).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        db = ReminderDbHelper.getInstance(this)

        setSupportActionBar(binding.toolbar)
        setupRecyclerView()
        setupListeners()
        checkPermissions()

        // Background update check on startup
        UpdateManager.checkForUpdates(this, isManualCheck = false)
    }

    override fun onResume() {
        super.onResume()
        loadReminders()
        UpdateManager.checkPendingInstall(this)
    }

    private fun checkPermissions() {
        // 1. Android 13+ Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // 2. Android 12+ Exact Alarm Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                MaterialAlertDialogBuilder(this)
                    .setTitle("⚡ Exact Alarms Required")
                    .setMessage("To ensure your alarms ring at the exact second even when your screen is locked, please enable 'Alarms & reminders' in system settings.")
                    .setPositiveButton("Enable in Settings") { _, _ ->
                        try {
                            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                        } catch (e: Exception) {
                            startActivity(Intent(Settings.ACTION_SETTINGS))
                        }
                    }
                    .setNegativeButton("Later", null)
                    .show()
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = ReminderAdapter(
            onReminderClick = { reminder ->
                val intent = Intent(this, AddEditReminderActivity::class.java).apply {
                    putExtra(AddEditReminderActivity.EXTRA_REMINDER_ID, reminder.id)
                }
                startActivity(intent)
            },
            onToggleComplete = { reminder ->
                val updated = db.toggleComplete(reminder.id)
                if (updated != null) {
                    if (updated.isCompleted) {
                        AlarmScheduler.cancelAlarm(this, updated.id)
                        Toast.makeText(this, "Marked as completed", Toast.LENGTH_SHORT).show()
                    } else {
                        // Repeating reminder rolled over!
                        AlarmScheduler.scheduleAlarm(this, updated)
                        Toast.makeText(this, "Rolled over to next interval!", Toast.LENGTH_SHORT).show()
                    }
                    loadReminders()
                }
            },
            onDeleteClick = { reminder ->
                showDeleteConfirmationDialog(reminder)
            }
        )

        binding.recyclerViewReminders.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }
    }

    private fun setupListeners() {
        binding.fabAddReminder.setOnClickListener {
            val intent = Intent(this, AddEditReminderActivity::class.java)
            startActivity(intent)
        }

        binding.swipeRefresh.setOnRefreshListener {
            loadReminders()
            binding.swipeRefresh.isRefreshing = false
        }

        binding.chipGroupFilters.setOnCheckedStateChangeListener { _, _ ->
            loadReminders()
        }

        binding.cardStatToday.setOnClickListener {
            binding.chipToday.isChecked = true
            loadReminders()
        }

        binding.cardStatUpcoming.setOnClickListener {
            binding.chipUpcoming.isChecked = true
            loadReminders()
        }

        binding.cardStatHigh.setOnClickListener {
            binding.chipHighPriority.isChecked = true
            loadReminders()
        }

        binding.cardStatCompleted.setOnClickListener {
            binding.chipCompleted.isChecked = true
            loadReminders()
        }
    }

    private fun loadReminders() {
        val allReminders = db.getAllReminders()

        // Update Overview Stats
        val now = System.currentTimeMillis()
        val todayCount = db.getTodayReminders().size
        val upcomingCount = db.getUpcomingReminders().size
        val highCount = allReminders.count { it.priority.equals("HIGH", ignoreCase = true) && !it.isCompleted }
        val doneCount = allReminders.count { it.isCompleted }

        binding.tvStatToday.text = todayCount.toString()
        binding.tvStatUpcoming.text = upcomingCount.toString()
        binding.tvStatHigh.text = highCount.toString()
        binding.tvStatCompleted.text = doneCount.toString()

        // Filter Reminders based on Selected Chip
        val filtered = when {
            binding.chipToday.isChecked -> db.getTodayReminders()
            binding.chipTomorrow.isChecked -> db.getTomorrowReminders()
            binding.chipUpcoming.isChecked -> db.getUpcomingReminders()
            binding.chipHighPriority.isChecked -> allReminders.filter { it.priority.equals("HIGH", ignoreCase = true) && !it.isCompleted }
            binding.chipFilterEvent.isChecked -> allReminders.filter { it.category.equals("Event", ignoreCase = true) }
            binding.chipFilterWork.isChecked -> allReminders.filter { it.category.equals("Work", ignoreCase = true) }
            binding.chipFilterPersonal.isChecked -> allReminders.filter { it.category.equals("Personal", ignoreCase = true) }
            binding.chipFilterMeeting.isChecked -> allReminders.filter { it.category.equals("Meeting", ignoreCase = true) }
            binding.chipFilterBirthday.isChecked -> allReminders.filter { it.category.equals("Birthday", ignoreCase = true) }
            binding.chipFilterHealth.isChecked -> allReminders.filter { it.category.equals("Health", ignoreCase = true) }
            binding.chipFilterFinance.isChecked -> allReminders.filter { it.category.equals("Finance", ignoreCase = true) }
            binding.chipFilterShopping.isChecked -> allReminders.filter { it.category.equals("Shopping", ignoreCase = true) }
            binding.chipFilterStudy.isChecked -> allReminders.filter { it.category.equals("Study", ignoreCase = true) }
            binding.chipCompleted.isChecked -> db.getCompletedReminders()
            else -> allReminders
        }

        adapter.submitList(filtered)

        if (filtered.isEmpty()) {
            when {
                binding.chipTomorrow.isChecked -> {
                    binding.tvEmptyTitle.text = "No tasks for tomorrow 🎉"
                    binding.tvEmptySubtitle.text = "You're all clear for tomorrow! Tap + below to schedule ahead."
                }
                binding.chipToday.isChecked -> {
                    binding.tvEmptyTitle.text = "No tasks for today 🎉"
                    binding.tvEmptySubtitle.text = "You're all caught up for today! Tap + below to add a reminder."
                }
                binding.chipCompleted.isChecked -> {
                    binding.tvEmptyTitle.text = "No completed tasks yet"
                    binding.tvEmptySubtitle.text = "Tasks you complete will be archived here."
                }
                else -> {
                    binding.tvEmptyTitle.text = "No reminders found"
                    binding.tvEmptySubtitle.text = "Tap the + button below to create your first scheduled alarm."
                }
            }
            binding.layoutEmpty.visibility = View.VISIBLE
            binding.recyclerViewReminders.visibility = View.GONE
        } else {
            binding.layoutEmpty.visibility = View.GONE
            binding.recyclerViewReminders.visibility = View.VISIBLE
        }
    }

    private fun showDeleteConfirmationDialog(reminder: Reminder) {
        MaterialAlertDialogBuilder(this)
            .setTitle("Delete Reminder?")
            .setMessage("Are you sure you want to delete '${reminder.title}'? This will also cancel any scheduled alarm.")
            .setPositiveButton("Delete") { _, _ ->
                db.deleteReminder(reminder.id)
                AlarmScheduler.cancelAlarm(this, reminder.id)
                loadReminders()
                Toast.makeText(this, "Reminder deleted", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_theme -> {
                showThemeSelectionDialog()
                true
            }
            R.id.action_test_alarm -> {
                AlarmScheduler.scheduleTestAlarm(this, 5)
                Toast.makeText(this, "🔔 Test alarm scheduled! Prepare to hear the alarm ring in 5 seconds...", Toast.LENGTH_LONG).show()
                true
            }
            R.id.action_check_update -> {
                UpdateManager.checkForUpdates(this, isManualCheck = true)
                true
            }
            R.id.action_update_settings -> {
                UpdateManager.showUpdateSettingsDialog(this)
                true
            }
            R.id.action_exact_alarm_settings -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                            data = Uri.parse("package:$packageName")
                        }
                        startActivity(intent)
                    } catch (e: Exception) {
                        startActivity(Intent(Settings.ACTION_SETTINGS))
                    }
                } else {
                    Toast.makeText(this, "Exact alarms are permitted by default on your Android version.", Toast.LENGTH_SHORT).show()
                }
                true
            }
            R.id.action_about -> {
                MaterialAlertDialogBuilder(this)
                    .setTitle("Smart Reminder v${BuildConfig.VERSION_NAME}")
                    .setMessage("100% Native Android Kotlin Application.\n\n• Real-time AlarmManager exact alerts\n• Custom device ringtones & sounds\n• Ringing Alarms and Notification-Only alerts\n• Rich Event Categories with filtering\n• Light, Dark & System Theme support\n• 100% offline with zero server tracking\n• Automatic reboot alarm restoration")
                    .setPositiveButton("OK", null)
                    .show()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun showThemeSelectionDialog() {
        val currentTheme = ThemeManager.getSavedTheme(this)
        val themes = arrayOf("System Default (Follow OS)", "☀️ Light Mode", "🌙 Dark Mode")
        val selectedIndex = when (currentTheme) {
            ThemeManager.THEME_LIGHT -> 1
            ThemeManager.THEME_DARK -> 2
            else -> 0
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("🎨 Choose Theme")
            .setSingleChoiceItems(themes, selectedIndex) { dialog, which ->
                val chosenTheme = when (which) {
                    1 -> ThemeManager.THEME_LIGHT
                    2 -> ThemeManager.THEME_DARK
                    else -> ThemeManager.THEME_SYSTEM
                }
                ThemeManager.setAndApplyTheme(this, chosenTheme)
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
