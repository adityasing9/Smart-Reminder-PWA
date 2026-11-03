package com.smartreminder.app.data

data class Reminder(
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val triggerTimeMillis: Long,
    val isCompleted: Boolean = false,
    val priority: String = "MEDIUM", // "HIGH", "MEDIUM", "LOW"
    val category: String = "General", // "General", "Event", "Work", "Personal", "Meeting", "Birthday", "Health", "Finance", "Shopping", "Study"
    val repeatType: String = "NONE", // "NONE", "DAILY", "WEEKLY", "MONTHLY"
    val soundUri: String? = null, // Custom device sound URI, or null for system default
    val soundTitle: String = "Default Alarm Sound",
    val alertType: String = "ALARM", // "ALARM" (full ringing alert) or "NOTIFICATION" (notification only)
    val createdAt: Long = System.currentTimeMillis()
)
