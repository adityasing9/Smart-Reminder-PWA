package com.smartreminder.app.data

import java.util.Calendar

data class Reminder(
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val triggerTimeMillis: Long,
    val isCompleted: Boolean = false,
    val priority: String = "MEDIUM", // "HIGH", "MEDIUM", "LOW"
    val category: String = "General", // "General", "Event", "Work", "Personal", "Meeting", "Birthday", "Health", "Finance", "Shopping", "Study"
    val repeatType: String = "NONE", // "NONE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"
    val customDays: String = "", // Comma-separated day-of-week ints e.g. "2,3,4,5,6" (Mon-Fri)
    val soundUri: String? = null, // Custom device sound URI, or null for system default
    val soundTitle: String = "Default Alarm Sound",
    val alertType: String = "ALARM", // "ALARM" (full ringing alert) or "NOTIFICATION" (notification only)
    val createdAt: Long = System.currentTimeMillis()
) {
    fun getCustomDaysSet(): Set<Int> {
        if (customDays.isBlank()) return emptySet()
        return customDays.split(",").mapNotNull { it.trim().toIntOrNull() }.toSet()
    }

    fun getRepeatDisplay(): String {
        return when (repeatType.uppercase()) {
            "DAILY" -> "Daily"
            "WEEKLY" -> "Weekly"
            "MONTHLY" -> "Monthly"
            "CUSTOM" -> {
                val days = getCustomDaysSet()
                if (days.isEmpty()) {
                    "Custom"
                } else if (days.size == 7) {
                    "Every Day"
                } else if (days == setOf(Calendar.MONDAY, Calendar.TUESDAY, Calendar.WEDNESDAY, Calendar.THURSDAY, Calendar.FRIDAY)) {
                    "Weekdays"
                } else if (days == setOf(Calendar.SATURDAY, Calendar.SUNDAY)) {
                    "Weekends"
                } else {
                    val dayNames = listOf(
                        Calendar.MONDAY to "Mon",
                        Calendar.TUESDAY to "Tue",
                        Calendar.WEDNESDAY to "Wed",
                        Calendar.THURSDAY to "Thu",
                        Calendar.FRIDAY to "Fri",
                        Calendar.SATURDAY to "Sat",
                        Calendar.SUNDAY to "Sun"
                    )
                    dayNames.filter { days.contains(it.first) }.joinToString(", ") { it.second }
                }
            }
            else -> ""
        }
    }
}
