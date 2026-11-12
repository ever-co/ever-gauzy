/** The routes live under `/api/task-automations` (plan §7). */
export const TASK_AUTOMATION_ROUTE_PREFIX = '/task-automations';

/** The outbox consumer's key (`subscriber:task-automations`): one delivery record per event. */
export const TASK_AUTOMATION_CONSUMER_KEY = 'task-automations';

/** The aggregate type of the change events, and the partition each task's events are kept in order in. */
export const TASK_AUTOMATION_AGGREGATE = 'task';
export const taskAutomationPartitionKey = (taskId: string): string => `task-automation:${taskId}`;

/**
 * The due-date schedule (plan §4): the queue it is asked on, its job and schedule names, and the named lock one
 * sweep holds across the processes.
 */
export const TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME = 'task-automation-maintenance';
export const TASK_AUTOMATION_DUE_SWEEP_JOB = 'task-automation.due-sweep';
export const TASK_AUTOMATION_DUE_SWEEP_SCHEDULE = 'task-automation.due-sweep.schedule';
export const TASK_AUTOMATION_DUE_SWEEP_LOCK = 'task-automation-due-sweep';
/** A sweep that could not run at all is tried again by the queue, a little later each time. */
export const TASK_AUTOMATION_DUE_SWEEP_ATTEMPTS = 3;
export const TASK_AUTOMATION_DUE_SWEEP_RETRY_DELAY_MS = 30_000;
/** Without a queue the API sweeps on its own timer, this often. */
export const TASK_AUTOMATION_DUE_SWEEP_INTERVAL_MS = 15 * 60_000;
/** How far back a sweep looks for due dates that passed (it catches up on a downtime of up to this). */
export const TASK_AUTOMATION_DUE_LOOKBACK_MS = 24 * 60 * 60_000;
/** How many due tasks a sweep reads at a time for one rule, and the most it runs the rule for in one sweep. */
export const TASK_AUTOMATION_DUE_BATCH = 200;

/** How long the capture trusts what it knows of an organization's rules before it reads them again. */
export const TASK_AUTOMATION_RULE_CACHE_MS = 30_000;

/**
 * A run left `RUNNING` (a process that stopped mid-run, or whose outcome could not be recorded) is taken over by a
 * redelivery after this long. Until then a redelivery is refused as "still running", so the outbox tries it again
 * later (its backoff reaches past this lease within the consumer's attempts) instead of counting it as done.
 */
export const TASK_AUTOMATION_RUN_LEASE_MS = 5 * 60_000;

/**
 * Runs younger than this are kept whatever the history bound: their keys are what stop a change delivered again, or a
 * due date the sweep sees again (it looks back a day), from running a rule twice. Older keys can no longer recur.
 */
export const TASK_AUTOMATION_RUN_DEDUPE_MS = TASK_AUTOMATION_DUE_LOOKBACK_MS + 60 * 60_000;

/** How long a run waits for another run of the same task to finish before it is put back for later. */
export const TASK_AUTOMATION_TASK_LOCK_WAIT_MS = 2_000;

/** The source and external identity of the Inbox notices the rules file (`upsertExternal` makes them idempotent). */
export const TASK_AUTOMATION_INBOX_SOURCE = 'TASK_AUTOMATION';
export const TASK_AUTOMATION_INBOX_EXTERNAL_SOURCE = 'task-automation';
