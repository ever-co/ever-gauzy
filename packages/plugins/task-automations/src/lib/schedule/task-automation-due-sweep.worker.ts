import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import {
	TASK_AUTOMATION_DUE_SWEEP_INTERVAL_MS,
	TASK_AUTOMATION_DUE_SWEEP_JOB,
	TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME
} from '../task-automation.constants';
import { ITaskAutomationDueSweepJob } from './task-automation-due-sweep.scheduler';
import { TaskAutomationDueSweepService } from './task-automation-due-sweep.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own retry sees it;
 * a rule that failed is the sweep's own business (it is tried again on the next one).
 */
@Injectable()
@QueueWorker(TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME)
export class TaskAutomationDueSweepWorker extends QueueWorkerHost {
	private readonly logger = new Logger(TaskAutomationDueSweepWorker.name);

	constructor(private readonly sweeps: TaskAutomationDueSweepService) {
		super();
	}

	@QueueJobHandler(TASK_AUTOMATION_DUE_SWEEP_JOB)
	async handleSweep(job: Job<ITaskAutomationDueSweepJob>): Promise<void> {
		try {
			await this.sweeps.sweep();
		} catch (error) {
			this.logger.error(
				`The task automation due-date sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}

/**
 * Without a queue root (a single container, no Redis) nothing enqueues the sweep, so the API runs it on a timer of
 * its own, every 15 minutes, under the same cross-process lock. The timer does not keep the process alive.
 */
@Injectable()
export class TaskAutomationDueSweepTimer implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(TaskAutomationDueSweepTimer.name);
	private timer?: NodeJS.Timeout;
	private running = false;

	constructor(private readonly sweeps: TaskAutomationDueSweepService) {}

	onApplicationBootstrap(): void {
		this.timer = setInterval(() => void this.tick(), TASK_AUTOMATION_DUE_SWEEP_INTERVAL_MS);
		this.timer.unref?.();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	/** One sweep, never two at once in this process; a failure is logged and the next tick tries again. */
	async tick(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			await this.sweeps.sweep();
		} catch (error) {
			this.logger.warn(`The task automation due-date sweep failed: ${(error as Error)?.message}`);
		} finally {
			this.running = false;
		}
	}
}
