import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { TaskAutomationSweepLock } from '../schedule/task-automation-sweep-lock';
import { TASK_AUTOMATION_TASK_LOCK_WAIT_MS } from '../task-automation.constants';

/**
 * A run that cannot go on now and must be tried again later: another run of the same task holds it, or this rule's
 * run for this change is still marked running. The outbox consumer lets it through, so the delivery is retried with
 * the outbox's backoff instead of being counted as done; the due-date sweep leaves the task to its next pass.
 */
export class TaskAutomationRetryLaterError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TaskAutomationRetryLaterError';
	}
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One run of a task at a time, across the processes (spec FR-11, FR-13). The outbox hands one task's changes over in
 * order, but the due-date sweep, and the sub-task triggers (which act on the parent from each sub-task's own
 * partition), reach a task from elsewhere: without the lock two rules could read the same labels and write two full
 * lists, the later one dropping the other's label, and both could pass the rate limit's count. The lock covers the
 * fresh read, the checks, the write and the recorded outcome.
 *
 * Taken without blocking a connection: a run tries for a short while, then gives up with
 * `TaskAutomationRetryLaterError`. PostgreSQL and MySQL hold it as the due sweep's lock does (an advisory lock, a
 * named lock); SQLite (one process) in the process.
 */
@Injectable()
export class TaskAutomationTaskLock {
	private readonly lock: TaskAutomationSweepLock;

	constructor(dataSource: DataSource) {
		this.lock = new TaskAutomationSweepLock(dataSource);
	}

	async run<T>(taskId: ID, work: () => Promise<T>, waitMs: number = TASK_AUTOMATION_TASK_LOCK_WAIT_MS): Promise<T> {
		const deadline = Date.now() + Math.max(0, waitMs);
		for (;;) {
			// The deadline holds while waiting for a lock connection too.
			const result = await this.lock.tryRun(`task:${taskId}`, async () => ({ value: await work() }), deadline);
			if (result) return result.value;
			if (Date.now() >= deadline) {
				throw new TaskAutomationRetryLaterError(`Another automation run of the task ${taskId} is under way.`);
			}
			await pause(100 + Math.floor(Math.random() * 100));
		}
	}
}
