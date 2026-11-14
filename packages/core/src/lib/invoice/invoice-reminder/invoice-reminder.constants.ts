/** The schedule the sweep is fired on. */
export const INVOICE_REMINDER_SWEEP_SCHEDULE = 'invoice-reminder.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const INVOICE_REMINDER_SWEEP_JOB = 'invoice-reminder.sweep';

/** The queue the sweep travels on. */
export const INVOICE_REMINDER_QUEUE_NAME = 'invoice-reminder';

/** How many invoices the sweep reads at a time. */
export const INVOICE_REMINDER_SWEEP_PAGE_SIZE = 100;

/**
 * How long one sweep may keep reading pages, in milliseconds. A sweep is asked for every hour; one that stops here
 * leaves the rest to the next, and a reminder stays due for two days (INVOICE_REMINDER_GRACE_MS).
 */
export const INVOICE_REMINDER_SWEEP_TIME_BUDGET_MS = 10 * 60 * 1000;

/** How often an API without a queue sweeps in-process: the queue's schedule is hourly. */
export const INVOICE_REMINDER_INLINE_SWEEP_MS = 60 * 60 * 1000;

/**
 * How long after its start an API without a queue sweeps for the first time: an API restarted more often than hourly
 * (a deployment, a crash loop) still sweeps.
 */
export const INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS = 60 * 1000;
