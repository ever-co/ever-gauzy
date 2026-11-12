import 'reflect-metadata';
import { CronExpression } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import { JIRA_IMPORT_SWEEP_JOB, JIRA_IMPORT_SWEEP_SCHEDULE, JIRA_QUEUE_NAME } from '../jira.constants';
import { JiraImportSweepService } from './jira-import-sweep.service';
import { JiraImportScheduler } from './jira-import.scheduler';
import { JiraImportWorker } from './jira-import.worker';

/** The scheduler package writes its declarations under these keys (its barrel does not export them). */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';
/** The key `@nestjs/bullmq`'s `Processor` — which the scheduler's `QueueWorker` is — writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

/**
 * The schedule names the queue and the queue job the worker consumes, and the worker answers that job by that name: a
 * schedule that enqueues a name no worker declares is a job that never runs, and nothing reports it.
 */
describe('JiraImportScheduler and JiraImportWorker', () => {
	it('pairs the schedule with the worker through one queue and one job name, every five minutes without overlap', () => {
		const schedule = Reflect.getMetadata(SCHEDULED_JOB_METADATA, JiraImportScheduler.prototype.enqueueSweep);
		expect(schedule).toMatchObject({
			name: JIRA_IMPORT_SWEEP_SCHEDULE,
			cron: CronExpression.EVERY_5_MINUTES,
			queueName: JIRA_QUEUE_NAME,
			queueJobName: JIRA_IMPORT_SWEEP_JOB,
			preventOverlap: true
		});
		expect(Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, JiraImportWorker.prototype.handleSweep)).toBe(JIRA_IMPORT_SWEEP_JOB);
		expect(Reflect.getMetadata(PROCESSOR_METADATA, JiraImportWorker)).toMatchObject({ name: JIRA_QUEUE_NAME });
	});

	it('runs the sweep once per job and raises a sweep that could not run', async () => {
		const run = jest.fn().mockResolvedValue({ due: 1, imported: 1, skipped: 0, failed: 0 });
		const worker = new JiraImportWorker({ run } as unknown as JiraImportSweepService);
		await worker.handleSweep({ name: JIRA_IMPORT_SWEEP_JOB, data: { requestedAt: now } } as Job<{ requestedAt: string }>);
		expect(run).toHaveBeenCalledTimes(1);

		run.mockRejectedValueOnce(new Error('the mappings could not be read'));
		jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);
		await expect(worker.handleSweep({ name: JIRA_IMPORT_SWEEP_JOB, data: { requestedAt: now } } as Job<{ requestedAt: string }>)).rejects.toThrow('the mappings could not be read');
	});
});

const now = '2026-11-07T12:00:00.000Z';
