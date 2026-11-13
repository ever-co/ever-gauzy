import 'reflect-metadata';
import { CronExpression } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import { ASANA_IMPORT_SWEEP_JOB, ASANA_IMPORT_SWEEP_SCHEDULE, ASANA_QUEUE_NAME } from '../asana.constants';
import { AsanaImportSweepService } from './asana-import-sweep.service';
import { AsanaImportScheduler } from './asana-import.scheduler';
import { AsanaImportWorker } from './asana-import.worker';

/** The scheduler package writes its declarations under these keys (its barrel does not export them). */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';
/** The key `@nestjs/bullmq`'s `Processor` — which the scheduler's `QueueWorker` is — writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

/**
 * The schedule names the queue and the queue job the worker consumes, and the worker answers that job by that name: a
 * schedule that enqueues a name no worker declares is a job that never runs, and nothing reports it.
 */
describe('AsanaImportScheduler and AsanaImportWorker', () => {
	it('pairs the schedule with the worker through one queue and one job name, every five minutes without overlap', () => {
		const schedule = Reflect.getMetadata(SCHEDULED_JOB_METADATA, AsanaImportScheduler.prototype.enqueueSweep);
		expect(schedule).toMatchObject({
			name: ASANA_IMPORT_SWEEP_SCHEDULE,
			cron: CronExpression.EVERY_5_MINUTES,
			queueName: ASANA_QUEUE_NAME,
			queueJobName: ASANA_IMPORT_SWEEP_JOB,
			preventOverlap: true
		});
		expect(Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, AsanaImportWorker.prototype.handleSweep)).toBe(ASANA_IMPORT_SWEEP_JOB);
		expect(Reflect.getMetadata(PROCESSOR_METADATA, AsanaImportWorker)).toMatchObject({ name: ASANA_QUEUE_NAME });
	});

	it('runs the sweep once per job and raises a sweep that could not run', async () => {
		const run = jest.fn().mockResolvedValue({ due: 1, imported: 1, skipped: 0, failed: 0 });
		const worker = new AsanaImportWorker({ run } as unknown as AsanaImportSweepService);
		await worker.handleSweep({ name: ASANA_IMPORT_SWEEP_JOB, data: { requestedAt: now } } as Job<{ requestedAt: string }>);
		expect(run).toHaveBeenCalledTimes(1);

		run.mockRejectedValueOnce(new Error('the mappings could not be read'));
		jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);
		await expect(worker.handleSweep({ name: ASANA_IMPORT_SWEEP_JOB, data: { requestedAt: now } } as Job<{ requestedAt: string }>)).rejects.toThrow('the mappings could not be read');
	});
});

const now = '2026-11-07T12:00:00.000Z';
