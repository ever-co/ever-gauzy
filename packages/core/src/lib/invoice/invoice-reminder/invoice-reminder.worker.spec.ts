/**
 * The payment reminder sweep: the schedule that asks for it, the worker that runs it, and the in-process sweep of an
 * API without a queue.
 *
 * - **The schedule names the queue and the queue job the worker consumes**, and the worker answers that job by that
 *   name: a schedule that enqueues a name no worker declares is a job that never runs, with nothing red anywhere.
 * - **A sweep that could not run is raised**, so the queue sees it, rather than reported as one that found nothing.
 * - **Without a queue, the API sweeps a minute after it starts, then every hour itself**, one pass at a time.
 *
 * The service is doubled and the queue is not stood up: the wiring is what is under test.
 */

/**
 * This import must stay FIRST, before any import that pulls a core service: the worker's constructor reaches the
 * invoice and email services, which reach the crud layer.
 */
import '../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import {
	INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS,
	INVOICE_REMINDER_INLINE_SWEEP_MS,
	INVOICE_REMINDER_QUEUE_NAME,
	INVOICE_REMINDER_SWEEP_JOB,
	INVOICE_REMINDER_SWEEP_SCHEDULE
} from './invoice-reminder.constants';
import { InvoiceReminderInlineSweep } from './invoice-reminder-inline';
import { IInvoiceReminderSweepJob, InvoiceReminderScheduler } from './invoice-reminder.scheduler';
import { InvoiceReminderService } from './invoice-reminder.service';
import { InvoiceReminderWorker } from './invoice-reminder.worker';

/** The metadata keys of the scheduler package (its barrel does not re-export them). */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';
/** The key `@nestjs/bullmq`'s `Processor` (the scheduler's `QueueWorker`) writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

const EMPTY_REPORT = { checked: 0, reminded: 0, blocked: 0, failed: 0 };

function queued(requestedAt = '2026-12-01T10:00:00.000Z'): Job<IInvoiceReminderSweepJob> {
	return { name: INVOICE_REMINDER_SWEEP_JOB, data: { requestedAt } } as Job<IInvoiceReminderSweepJob>;
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

describe('InvoiceReminderScheduler and InvoiceReminderWorker', () => {
	const schedule = () =>
		Reflect.getMetadata(
			SCHEDULED_JOB_METADATA,
			(InvoiceReminderScheduler.prototype as unknown as Record<string, object>)['enqueueSweep']
		);

	it('asks for a sweep every hour, on the queue and under the job name the worker consumes', async () => {
		expect(schedule()).toMatchObject({
			name: INVOICE_REMINDER_SWEEP_SCHEDULE,
			cron: CronExpression.EVERY_HOUR,
			queueName: INVOICE_REMINDER_QUEUE_NAME,
			queueJobName: INVOICE_REMINDER_SWEEP_JOB,
			preventOverlap: true
		});
		expect(
			Reflect.getMetadata(
				QUEUE_JOB_HANDLER_METADATA,
				(InvoiceReminderWorker.prototype as unknown as Record<string, object>)['handleSweep']
			)
		).toBe(INVOICE_REMINDER_SWEEP_JOB);
		expect(Reflect.getMetadata(PROCESSOR_METADATA, InvoiceReminderWorker)).toMatchObject({
			name: INVOICE_REMINDER_QUEUE_NAME
		});
		await expect(new InvoiceReminderScheduler().enqueueSweep()).resolves.toEqual({
			requestedAt: expect.any(String)
		});
	});

	it('runs one sweep per job', async () => {
		const sweep = jest.fn().mockResolvedValue(EMPTY_REPORT);
		const worker = new InvoiceReminderWorker({ sweep } as unknown as InvoiceReminderService);

		await worker.handleSweep(queued());

		expect(sweep).toHaveBeenCalledTimes(1);
	});

	it('raises a sweep that could not run, so the queue sees it', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const worker = new InvoiceReminderWorker({
			sweep: jest.fn().mockRejectedValue(refusal)
		} as unknown as InvoiceReminderService);

		await expect(worker.handleSweep(queued())).rejects.toBe(refusal);
	});
});

describe('InvoiceReminderInlineSweep (an API without a queue)', () => {
	async function sweepOver(sweep: jest.Mock) {
		const moduleRef = await Test.createTestingModule({
			providers: [{ provide: InvoiceReminderService, useValue: { sweep } }, InvoiceReminderInlineSweep]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();
		return app;
	}

	/** Lets a finished pass's promise chain run to the end. */
	async function settle(): Promise<void> {
		for (let i = 0; i < 10; i += 1) await Promise.resolve();
	}

	it('sweeps a minute after the start, then every hour, as the queue schedule does, and stops with the application', async () => {
		jest.useFakeTimers();
		const sweep = jest.fn().mockResolvedValue(EMPTY_REPORT);
		const app = await sweepOver(sweep);

		expect(sweep).not.toHaveBeenCalled();
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS);
		await settle();
		// An API restarted more often than hourly still sweeps
		expect(sweep).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS - INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(2);
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(3);

		await app.close();
		jest.advanceTimersByTime(3 * INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(3);
	});

	it('stops before its first sweep when the application closes first', async () => {
		jest.useFakeTimers();
		const sweep = jest.fn().mockResolvedValue(EMPTY_REPORT);
		const app = await sweepOver(sweep);

		await app.close();
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();

		expect(sweep).not.toHaveBeenCalled();
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

		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS);
		await settle();
		// The first pass is still running an hour later: no second one beside it
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(1);

		finish();
		await settle();
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();
		jest.advanceTimersByTime(INVOICE_REMINDER_INLINE_SWEEP_MS);
		await settle();
		expect(sweep).toHaveBeenCalledTimes(3);

		await app.close();
	});
});
