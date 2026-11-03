package com.smartreminder.app.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.Calendar

class ReminderDbHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "smart_reminders.db"
        const val DATABASE_VERSION = 1

        const val TABLE_REMINDERS = "reminders"
        const val COL_ID = "id"
        const val COL_TITLE = "title"
        const val COL_DESCRIPTION = "description"
        const val COL_TRIGGER_TIME = "trigger_time"
        const val COL_IS_COMPLETED = "is_completed"
        const val COL_PRIORITY = "priority"
        const val COL_CATEGORY = "category"
        const val COL_REPEAT_TYPE = "repeat_type"
        const val COL_CREATED_AT = "created_at"

        @Volatile
        private var instance: ReminderDbHelper? = null

        fun getInstance(context: Context): ReminderDbHelper {
            return instance ?: synchronized(this) {
                instance ?: ReminderDbHelper(context.applicationContext).also { instance = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createQuery = """
            CREATE TABLE $TABLE_REMINDERS (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_TITLE TEXT NOT NULL,
                $COL_DESCRIPTION TEXT,
                $COL_TRIGGER_TIME INTEGER NOT NULL,
                $COL_IS_COMPLETED INTEGER DEFAULT 0,
                $COL_PRIORITY TEXT DEFAULT 'MEDIUM',
                $COL_CATEGORY TEXT DEFAULT 'General',
                $COL_REPEAT_TYPE TEXT DEFAULT 'NONE',
                $COL_CREATED_AT INTEGER NOT NULL
            )
        """.trimIndent()
        db.execSQL(createQuery)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_REMINDERS")
        onCreate(db)
    }

    fun insertReminder(reminder: Reminder): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_TITLE, reminder.title)
            put(COL_DESCRIPTION, reminder.description)
            put(COL_TRIGGER_TIME, reminder.triggerTimeMillis)
            put(COL_IS_COMPLETED, if (reminder.isCompleted) 1 else 0)
            put(COL_PRIORITY, reminder.priority)
            put(COL_CATEGORY, reminder.category)
            put(COL_REPEAT_TYPE, reminder.repeatType)
            put(COL_CREATED_AT, reminder.createdAt)
        }
        return db.insert(TABLE_REMINDERS, null, values)
    }

    fun updateReminder(reminder: Reminder): Int {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_TITLE, reminder.title)
            put(COL_DESCRIPTION, reminder.description)
            put(COL_TRIGGER_TIME, reminder.triggerTimeMillis)
            put(COL_IS_COMPLETED, if (reminder.isCompleted) 1 else 0)
            put(COL_PRIORITY, reminder.priority)
            put(COL_CATEGORY, reminder.category)
            put(COL_REPEAT_TYPE, reminder.repeatType)
        }
        return db.update(TABLE_REMINDERS, values, "$COL_ID = ?", arrayOf(reminder.id.toString()))
    }

    fun deleteReminder(id: Long): Int {
        val db = writableDatabase
        return db.delete(TABLE_REMINDERS, "$COL_ID = ?", arrayOf(id.toString()))
    }

    fun getReminderById(id: Long): Reminder? {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_REMINDERS, null, "$COL_ID = ?",
            arrayOf(id.toString()), null, null, null
        )
        cursor.use {
            if (it.moveToFirst()) {
                return parseCursor(it)
            }
        }
        return null
    }

    fun getAllReminders(): List<Reminder> {
        val list = mutableListOf<Reminder>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_REMINDERS, null, null, null, null, null, "$COL_TRIGGER_TIME ASC"
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(parseCursor(it))
            }
        }
        return list
    }

    fun getUpcomingReminders(): List<Reminder> {
        val list = mutableListOf<Reminder>()
        val now = System.currentTimeMillis()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_REMINDERS, null,
            "$COL_IS_COMPLETED = 0 AND $COL_TRIGGER_TIME > ?",
            arrayOf(now.toString()), null, null, "$COL_TRIGGER_TIME ASC"
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(parseCursor(it))
            }
        }
        return list
    }

    fun getTodayReminders(): List<Reminder> {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val startOfDay = cal.timeInMillis

        cal.set(Calendar.HOUR_OF_DAY, 23)
        cal.set(Calendar.MINUTE, 59)
        cal.set(Calendar.SECOND, 59)
        cal.set(Calendar.MILLISECOND, 999)
        val endOfDay = cal.timeInMillis

        val list = mutableListOf<Reminder>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_REMINDERS, null,
            "$COL_TRIGGER_TIME BETWEEN ? AND ?",
            arrayOf(startOfDay.toString(), endOfDay.toString()),
            null, null, "$COL_TRIGGER_TIME ASC"
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(parseCursor(it))
            }
        }
        return list
    }

    fun getCompletedReminders(): List<Reminder> {
        val list = mutableListOf<Reminder>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_REMINDERS, null,
            "$COL_IS_COMPLETED = 1",
            null, null, null, "$COL_TRIGGER_TIME DESC"
        )
        cursor.use {
            while (it.moveToNext()) {
                list.add(parseCursor(it))
            }
        }
        return list
    }

    fun toggleComplete(id: Long): Reminder? {
        val reminder = getReminderById(id) ?: return null

        if (!reminder.isCompleted && reminder.repeatType != "NONE") {
            // Roll over to next repeating interval
            val nextTime = calculateNextTrigger(reminder.triggerTimeMillis, reminder.repeatType)
            val updated = reminder.copy(
                triggerTimeMillis = nextTime,
                isCompleted = false
            )
            updateReminder(updated)
            return updated
        } else {
            val updated = reminder.copy(isCompleted = !reminder.isCompleted)
            updateReminder(updated)
            return updated
        }
    }

    private fun calculateNextTrigger(currentTime: Long, repeatType: String): Long {
        val cal = Calendar.getInstance().apply { timeInMillis = currentTime }
        when (repeatType) {
            "DAILY" -> cal.add(Calendar.DAY_OF_YEAR, 1)
            "WEEKLY" -> cal.add(Calendar.WEEK_OF_YEAR, 1)
            "MONTHLY" -> cal.add(Calendar.MONTH, 1)
            "YEARLY" -> cal.add(Calendar.YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun parseCursor(cursor: Cursor): Reminder {
        return Reminder(
            id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID)),
            title = cursor.getString(cursor.getColumnIndexOrThrow(COL_TITLE)),
            description = cursor.getString(cursor.getColumnIndexOrThrow(COL_DESCRIPTION)) ?: "",
            triggerTimeMillis = cursor.getLong(cursor.getColumnIndexOrThrow(COL_TRIGGER_TIME)),
            isCompleted = cursor.getInt(cursor.getColumnIndexOrThrow(COL_IS_COMPLETED)) == 1,
            priority = cursor.getString(cursor.getColumnIndexOrThrow(COL_PRIORITY)) ?: "MEDIUM",
            category = cursor.getString(cursor.getColumnIndexOrThrow(COL_CATEGORY)) ?: "General",
            repeatType = cursor.getString(cursor.getColumnIndexOrThrow(COL_REPEAT_TYPE)) ?: "NONE",
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(COL_CREATED_AT))
        )
    }
}
