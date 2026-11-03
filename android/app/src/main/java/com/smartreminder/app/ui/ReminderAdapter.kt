package com.smartreminder.app.ui

import android.graphics.Paint
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.smartreminder.app.R
import com.smartreminder.app.data.Reminder
import com.smartreminder.app.databinding.ItemReminderBinding
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class ReminderAdapter(
    private val onReminderClick: (Reminder) -> Unit,
    private val onToggleComplete: (Reminder) -> Unit,
    private val onDeleteClick: (Reminder) -> Unit
) : ListAdapter<Reminder, ReminderAdapter.ReminderViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ReminderViewHolder {
        val binding = ItemReminderBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ReminderViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ReminderViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ReminderViewHolder(private val binding: ItemReminderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(reminder: Reminder) {
            val context = binding.root.context

            // Title & Description
            binding.tvTitle.text = reminder.title
            if (reminder.description.isNotBlank()) {
                binding.tvDescription.text = reminder.description
                binding.tvDescription.visibility = View.VISIBLE
            } else {
                binding.tvDescription.visibility = View.GONE
            }

            // Completed State & Strike-Through
            binding.cbComplete.setOnCheckedChangeListener(null)
            binding.cbComplete.isChecked = reminder.isCompleted

            if (reminder.isCompleted) {
                binding.tvTitle.paintFlags = binding.tvTitle.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                binding.root.alpha = 0.6f
            } else {
                binding.tvTitle.paintFlags = binding.tvTitle.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
                binding.root.alpha = 1.0f
            }

            // Priority Indicator & Badge
            when (reminder.priority.uppercase()) {
                "HIGH" -> {
                    binding.viewPriorityStripe.setBackgroundColor(ContextCompat.getColor(context, R.color.priority_high))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(context, R.color.priority_high))
                    binding.tvPriorityBadge.text = "HIGH"
                    binding.tvPriorityBadge.visibility = View.VISIBLE
                }
                "MEDIUM" -> {
                    binding.viewPriorityStripe.setBackgroundColor(ContextCompat.getColor(context, R.color.priority_medium))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(context, R.color.priority_medium))
                    binding.tvPriorityBadge.text = "MED"
                    binding.tvPriorityBadge.visibility = View.VISIBLE
                }
                else -> {
                    binding.viewPriorityStripe.setBackgroundColor(ContextCompat.getColor(context, R.color.priority_low))
                    binding.tvPriorityBadge.setTextColor(ContextCompat.getColor(context, R.color.priority_low))
                    binding.tvPriorityBadge.text = "LOW"
                    binding.tvPriorityBadge.visibility = View.VISIBLE
                }
            }

            // Category Badge
            val catEmoji = when (reminder.category) {
                "Event" -> "📅 Event"
                "Work" -> "💼 Work"
                "Personal" -> "👤 Personal"
                "Meeting" -> "🤝 Meeting"
                "Birthday" -> "🎂 Birthday"
                "Health" -> "💊 Health"
                "Finance" -> "💰 Finance"
                "Shopping" -> "🛒 Shopping"
                "Study" -> "📚 Study"
                else -> "📌 General"
            }
            binding.tvCategoryBadge.text = catEmoji
            binding.tvCategoryBadge.visibility = View.VISIBLE

            // Alert Type Badge
            if (reminder.alertType.equals("NOTIFICATION", ignoreCase = true)) {
                binding.tvAlertBadge.text = "💬 Notify"
            } else {
                binding.tvAlertBadge.text = "🔔 Alarm"
            }
            binding.tvAlertBadge.visibility = View.VISIBLE

            // Repeat Badge
            if (reminder.repeatType != "NONE") {
                binding.tvRepeatBadge.text = "🔁 ${reminder.repeatType.lowercase().capitalize(Locale.getDefault())}"
                binding.tvRepeatBadge.visibility = View.VISIBLE
            } else {
                binding.tvRepeatBadge.visibility = View.GONE
            }

            // Date & Time Formatting
            val now = System.currentTimeMillis()
            val isOverdue = !reminder.isCompleted && reminder.triggerTimeMillis < now
            binding.tvTimeBadge.text = formatDateTime(reminder.triggerTimeMillis)

            if (isOverdue) {
                binding.tvTimeBadge.setTextColor(ContextCompat.getColor(context, R.color.priority_high))
                binding.tvTimeBadge.text = "⚠️ ${binding.tvTimeBadge.text}"
            } else {
                binding.tvTimeBadge.setTextColor(ContextCompat.getColor(context, R.color.primary_dark))
            }

            // Event Listeners
            binding.root.setOnClickListener { onReminderClick(reminder) }
            binding.cbComplete.setOnClickListener { onToggleComplete(reminder) }
            binding.btnDelete.setOnClickListener { onDeleteClick(reminder) }
        }

        private fun formatDateTime(millis: Long): String {
            val date = Date(millis)
            val calTarget = Calendar.getInstance().apply { timeInMillis = millis }
            val calNow = Calendar.getInstance()

            val isToday = calTarget.get(Calendar.YEAR) == calNow.get(Calendar.YEAR) &&
                    calTarget.get(Calendar.DAY_OF_YEAR) == calNow.get(Calendar.DAY_OF_YEAR)

            val isTomorrow = calTarget.get(Calendar.YEAR) == calNow.get(Calendar.YEAR) &&
                    calTarget.get(Calendar.DAY_OF_YEAR) == calNow.get(Calendar.DAY_OF_YEAR) + 1

            val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
            val dateFormat = SimpleDateFormat("EEE, MMM d", Locale.getDefault())

            return when {
                isToday -> "Today, ${timeFormat.format(date)}"
                isTomorrow -> "Tomorrow, ${timeFormat.format(date)}"
                else -> "${dateFormat.format(date)} • ${timeFormat.format(date)}"
            }
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<Reminder>() {
        override fun areItemsTheSame(oldItem: Reminder, newItem: Reminder): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Reminder, newItem: Reminder): Boolean = oldItem == newItem
    }
}
