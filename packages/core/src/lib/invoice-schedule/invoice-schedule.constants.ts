/** The schedule the sweep is fired on. */
export const INVOICE_SCHEDULE_SWEEP_SCHEDULE = 'invoice-schedule.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const INVOICE_SCHEDULE_SWEEP_JOB = 'invoice-schedule.sweep';

/** The queue the sweep travels on. */
export const INVOICE_SCHEDULE_QUEUE_NAME = 'invoice-schedule';

/** How many schedules the sweep reads at a time. */
export const INVOICE_SCHEDULE_SWEEP_PAGE_SIZE = 100;

/**
 * How long one sweep may keep reading pages, in milliseconds. A sweep is asked for every hour; one that stops here
 * leaves the rest to the next, and a period stays due for a week (INVOICE_SCHEDULE_CATCH_UP_DAYS).
 */
export const INVOICE_SCHEDULE_SWEEP_TIME_BUDGET_MS = 20 * 60 * 1000;

/**
 * How long after it was claimed a run that failed, or that a stopped process left claimed, is taken again: about the
 * next hourly sweep, so a failure is tried again once an hour while its period is due, never in a loop.
 */
export const INVOICE_SCHEDULE_RETRY_AFTER_MS = 55 * 60 * 1000;

/** How often an API without a queue sweeps in-process: the queue's schedule is hourly. */
export const INVOICE_SCHEDULE_INLINE_SWEEP_MS = 60 * 60 * 1000;

/**
 * How long after its start an API without a queue sweeps for the first time: an API restarted more often than hourly
 * (a deployment, a crash loop) still sweeps.
 */
export const INVOICE_SCHEDULE_INLINE_FIRST_SWEEP_MS = 2 * 60 * 1000;
