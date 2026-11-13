/**
 * The timer reminder sweep: the schedule that asks for it, the worker that runs it, the in-process sweep of an API
 * without a queue, and the switch that turns the whole of it on.
 *
 * - **The schedule names the queue and the queue job the worker consumes**, and the worker answers that job by that
 *   name: a schedule that enqueues a name no worker declares is a job that never runs, with nothing red anywhere.
 * - **A sweep that could not run is raised**, so the queue sees it, rather than reported as one that found nothing.
 * - **Without a queue, the API sweeps every minute itself**, one pass at a time.
 * - **It is off unless switched on**, as the platform's other new notification producers are.
 *
 * The service is doubled and the queue is not stood up: the wiring is what is under test.
 */

/**
 * This import must stay FIRST, before any import that pulls a core service: the worker's constructor reaches the
 * notification service, which reaches the crud layer.
 */
import '../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import {
	TIMER_REMINDER_INLINE_SWEEP_MS,
	TIMER_REMINDER_QUEUE_NAME,
	TIMER_REMINDER_SWEEP_JOB,
	TIMER_REMINDER_SWEEP_SCHEDULE
} from './timer-reminder.constants';
import { isTimerRemindersEnabled } from './timer-reminder-enabled';
import { TimerReminderInlineSweep } from './timer-reminder-inline';
import { ITimerReminderSweepJob, TimerReminderScheduler } from './timer-reminder.scheduler';
import { TimerReminderService } from './timer-reminder.service';
import { TimerReminderWorker } from './timer-reminder.worker';

/** The metadata keys of the scheduler package (its barrel does not re-export them). */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';
/** The key `@nestjs/bullmq`'s `Processor` (the scheduler's `QueueWorker`) writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

const EMPTY_REPORT = { checked: 0, reminded: 0, recovered: 0, failed: 0 };

function queued(requestedAt = '2026-11-11T18:00:00.000Z'): Job<ITimerReminderSweepJob> {
	return { name: TIMER_REMINDER_SWEEP_JOB, data: { requestedAt } } as Job<ITimerReminderSweepJob>;
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('TimerReminderScheduler and TimerReminderWorker', () => {
	const schedule = () =>
		Reflect.getMetadata(
			SCHEDULED_JOB_METADATA,
			(TimerReminderScheduler.prototype as unknown as Record<string, object>)['enqueueSweep']
		);

	it('asks for a sweep every minute, on the queue and under the job name the worker consumes', async () => {
		expect(schedule()).toMatchObject({
			name: TIMER_REMINDER_SWEEP_SCHEDULE,
			cron: CronExpression.EVERY_MINUTE,
			queueName: TIMER_REMINDER_QUEUE_NAME,
			queueJobName: TIMER_REMINDER_SWEEP_JOB,
			preventOverlap: true
		});
		expect(
			Reflect.getMetadata(
				QUEUE_JOB_HANDLER_METADATA,
				(TimerReminderWorker.prototype as unknown as Record<string, object>)['handleSweep']
			)
		).toBe(TIMER_REMINDER_SWEEP_JOB);
		expect(Reflect.getMetadata(PROCESSOR_METADATA, TimerReminderWorker)).toMatchObject({
			name: TIMER_REMINDER_QUEUE_NAME
		});
		await expect(new TimerReminderScheduler().enqueueSweep()).resolves.toEqual({
			requestedAt: expect.any(String)
		});
	});

	it('runs one sweep per job', async () => {
		const sweep = jest.fn().mockResolvedValue(EMPTY_REPORT);
		const worker = new TimerReminderWorker({ sweep } as unknown as TimerReminderService);

		await worker.handleSweep(queued());

		expect(sweep).toHaveBeenCalledTimes(1);
	});

	it('raises a sweep that could not run, so the queue sees it', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const worker = new TimerReminderWorker({
			sweep: jest.fn().mockRejectedValue(refusal)
		} as unknown as TimerReminderService);

		await expect(worker.handleSweep(queued())).rejects.toBe(refusal);
	});
});

describe('TimerReminderInlineSweep (an API without a queue)', () => {
	async function sweepOver(sweep: jest.Mock) {
		const moduleRef = await Test.createTestingModule({
			providers: [{ provide: TimerReminderService, useValue: { sweep } }, TimerReminderInlineSweep]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();
		return app;
	}

	/** Lets a finished pass's promise chain run to the end. */
	async function settle(): Promise<void> {
		for (let i = 0; i < 10; i += 1) await Promise.resolve();
	}

	it('sweeps every minute, as the queue schedule does, and stops with the application', async () => {
		jest.useFakeTimers();
		const sweep = jest.fn().mockResolvedValue(EMPTY_REPORT);
		const app = await sweepOver(sweep);

		expect(sweep).not.toHaveBeenCalled();
		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(2);

		await app.close();
		jest.advanceTimersByTime(3 * TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(2);
	});

	it('runs one pass at a time, and keeps sweeping after a pass that failed', async () => {
		jest.useFakeTimers();
		let finish: () => void = () => undefined;
		const sweep = jest
			.fn()
			.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
			.mockRejectedValueOnce(new Error('database is locked'))
			.mockResolvedValue(EMPTY_REPORT);
		const app = await sweepOver(sweep);

		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		// The first pass is still running a minute later: no second one beside it
		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(1);

		finish();
		await settle();
		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		jest.advanceTimersByTime(TIMER_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(3);

		await app.close();
	});
});

describe('isTimerRemindersEnabled', () => {
	it('is on only for exactly "true", and reports any other value once', () => {
		const warn = jest.fn();

		expect(isTimerRemindersEnabled({ GAUZY_TIMER_REMINDERS_ENABLED: 'true' }, warn)).toBe(true);
		expect(isTimerRemindersEnabled({}, warn)).toBe(false);
		expect(isTimerRemindersEnabled({ GAUZY_TIMER_REMINDERS_ENABLED: '' }, warn)).toBe(false);
		expect(isTimerRemindersEnabled({ GAUZY_TIMER_REMINDERS_ENABLED: 'false' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();

		expect(isTimerRemindersEnabled({ GAUZY_TIMER_REMINDERS_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		// The value itself is never repeated
		expect(warn.mock.calls[0][0]).not.toContain('yes');
	});
});
