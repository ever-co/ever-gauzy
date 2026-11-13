/** The schedule the sweep is fired on. */
export const TIMER_REMINDER_SWEEP_SCHEDULE = 'timer-reminder.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const TIMER_REMINDER_SWEEP_JOB = 'timer-reminder.sweep';

/** The queue the sweep travels on. */
export const TIMER_REMINDER_QUEUE_NAME = 'timer-reminder';

/** How many running time logs the sweep reads at a time. */
export const TIMER_REMINDER_SWEEP_PAGE_SIZE = 200;

/**
 * How long one sweep may keep reading pages, in milliseconds. A sweep is asked for every minute, so one that stops
 * here leaves the rest to the next, which starts from the oldest runs again.
 */
export const TIMER_REMINDER_SWEEP_TIME_BUDGET_MS = 45_000;

/**
 * How long a claim may stay unfiled before a sweep takes it over and files the reminder itself: the process that took it
 * stopped between its claim and its filing. A filing takes a moment; five minutes leaves a slow one alone.
 */
export const TIMER_REMINDER_STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * How long ago a run may have started and still be reminded of. A timer left running for a week is a log nobody stopped
 * (an app that quit without its stop) rather than one someone is timing, and switching the reminders on must not email
 * every such log at its first sweep.
 */
export const TIMER_REMINDER_MAX_RUN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** How often an API without a queue sweeps in-process: the queue's schedule is per minute. */
export const TIMER_REMINDER_INLINE_SWEEP_MS = 60_000;
