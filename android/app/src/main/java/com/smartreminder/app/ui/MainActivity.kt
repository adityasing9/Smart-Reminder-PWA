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
import com.smartreminder.app.R
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.data.ReminderDbHelper
import com.smartreminder.app.databinding.ActivityMainBinding
import com.smartreminder.app.util.AlarmScheduler
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
            binding.chipUpcoming.isChecked -> db.getUpcomingReminders()
            binding.chipHighPriority.isChecked -> allReminders.filter { it.priority.equals("HIGH", ignoreCase = true) && !it.isCompleted }
            binding.chipCompleted.isChecked -> db.getCompletedReminders()
            else -> allReminders
        }

        adapter.submitList(filtered)

        if (filtered.isEmpty()) {
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
            R.id.action_test_alarm -> {
                AlarmScheduler.scheduleTestAlarm(this, 5)
                Toast.makeText(this, "🔔 Test alarm scheduled! Prepare to hear the alarm ring in 5 seconds...", Toast.LENGTH_LONG).show()
                true
            }
            R.id.action_check_update -> {
                UpdateManager.checkForUpdates(this, isManualCheck = true)
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
                    .setTitle("Smart Reminder v2.0.0")
                    .setMessage("100% Native Android Kotlin Application.\n\n• Real-time AlarmManager alerts\n• High-priority heads-up notifications & ringtones\n• Works completely offline with zero servers\n• Automatic reboot alarm restoration")
                    .setPositiveButton("OK", null)
                    .show()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
