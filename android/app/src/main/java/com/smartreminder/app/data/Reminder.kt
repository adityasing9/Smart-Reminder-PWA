package com.smartreminder.app.data

data class Reminder(
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val triggerTimeMillis: Long,
    val isCompleted: Boolean = false,
    val priority: String = "MEDIUM", // "HIGH", "MEDIUM", "LOW"
    val category: String = "General", // "General", "Work", "Personal", "Health", "Finance"
    val repeatType: String = "NONE", // "NONE", "DAILY", "WEEKLY", "MONTHLY"
    val createdAt: Long = System.currentTimeMillis()
)
