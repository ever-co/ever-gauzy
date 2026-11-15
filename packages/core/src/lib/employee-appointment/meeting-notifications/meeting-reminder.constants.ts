/** The schedule the sweep is fired on. */
export const MEETING_REMINDER_SWEEP_SCHEDULE = 'meeting-reminder.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const MEETING_REMINDER_SWEEP_JOB = 'meeting-reminder.sweep';

/** The queue the sweep travels on. */
export const MEETING_REMINDER_QUEUE_NAME = 'meeting-reminder';

/** How many meetings the sweep reads at a time. */
export const MEETING_REMINDER_SWEEP_PAGE_SIZE = 200;

/**
 * How long one sweep may keep reading pages, in milliseconds. A sweep is asked for every minute, so one that stops
 * here leaves the rest to the next, which starts from the soonest meetings again.
 */
export const MEETING_REMINDER_SWEEP_TIME_BUDGET_MS = 45_000;

/**
 * How long a claim may stay unfiled before a sweep takes it over and files the reminder itself: the process that took it
 * stopped between its claim and its filing. A filing takes a moment; two minutes leaves a slow one alone and still
 * reminds before most meetings start.
 */
export const MEETING_REMINDER_STALE_CLAIM_MS = 2 * 60 * 1000;

/** How often an API without a queue sweeps in-process: the queue's schedule is per minute. */
export const MEETING_REMINDER_INLINE_SWEEP_MS = 60_000;
