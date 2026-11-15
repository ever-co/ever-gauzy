/** The schedule the sweep is fired on. */
export const TASK_DUE_REMINDER_SWEEP_SCHEDULE = 'task-due-reminder.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const TASK_DUE_REMINDER_SWEEP_JOB = 'task-due-reminder.sweep';

/** The queue the sweep travels on. */
export const TASK_DUE_REMINDER_QUEUE_NAME = 'task-due-reminder';

/** How many task assignments the sweep reads at a time. */
export const TASK_DUE_REMINDER_SWEEP_PAGE_SIZE = 200;

/**
 * How long one sweep may keep reading pages, in milliseconds. A sweep is asked for every five minutes, so one that
 * stops here leaves the rest to the next.
 */
export const TASK_DUE_REMINDER_SWEEP_TIME_BUDGET_MS = 4 * 60 * 1000;

/**
 * How long a claim may stay unfiled before a sweep takes it over and files the reminder itself: the process that took it
 * stopped between its claim and its filing. A filing takes a moment; ten minutes leaves a slow one alone.
 */
export const TASK_DUE_REMINDER_STALE_CLAIM_MS = 10 * 60 * 1000;

/** How often an API without a queue sweeps in-process, as the queue's schedule does. */
export const TASK_DUE_REMINDER_INLINE_SWEEP_MS = 5 * 60 * 1000;
