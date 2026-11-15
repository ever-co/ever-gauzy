import 'reflect-metadata';
import { DiscoveredScheduledJob, ResolvedScheduledJobOptions } from '../interfaces/discovered-scheduled-job.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { SchedulerQueueJobInput } from '../interfaces/scheduler-queue-job.interface';
import { SchedulerJobRunnerService } from './scheduler-job-runner.service';

/**
 * ever-co/ever-gauzy#11891: a queued schedule's run is the enqueue alone, so `preventOverlap` never saw the job it
 * added waiting or running in another process. While the consumers were down, every tick added one more job (one a
 * minute for the timer reminder sweep), and they all ran once the consumers came back.
 */
describe('SchedulerJobRunnerService: one queued job per schedule at a time (#11891)', () => {
	const moduleOptions = {
		enabled: true,
		enableQueueing: true,
		defaultQueueName: 'default-queue',
		logRegisteredJobs: false,
		defaultJobOptions: { enabled: true, preventOverlap: true, retries: 0, retryDelayMs: 0, maxRandomDelayMs: 0 }
	} as ResolvedSchedulerModuleOptions;

	const jobOptions = (overrides: Partial<ResolvedScheduledJobOptions> = {}): ResolvedScheduledJobOptions => ({
		enabled: true,
		runOnStart: false,
		preventOverlap: true,
		retries: 0,
		retryDelayMs: 0,
		maxRandomDelayMs: 0,
		...overrides
	});

	/** A runner whose queue keeps every job it is asked to add. */
	const runnerWithQueue = () => {
		const added: SchedulerQueueJobInput[] = [];
		const queueService = {
			enqueue: async (input: SchedulerQueueJobInput) => {
				added.push(input);
			}
		};

		return { runner: new SchedulerJobRunnerService(moduleOptions, queueService as never), added };
	};

	/** The timer reminder sweep, as `TimerReminderScheduler` declares it. */
	const timerReminderSweep = (overrides: Partial<ResolvedScheduledJobOptions> = {}): DiscoveredScheduledJob => ({
		id: 'timer-reminder.sweep.schedule',
		providerName: 'TimerReminderScheduler',
		methodName: 'enqueueSweep',
		options: jobOptions({
			cron: '0 * * * * *',
			queueName: 'timer-reminder',
			queueJobName: 'timer-reminder.sweep',
			queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
			...overrides
		}),
		handler: async () => ({ requestedAt: new Date().toISOString() })
	});

	it("adds a tick's job deduplicated by the schedule's id, with no fixed job id", async () => {
		const { runner, added } = runnerWithQueue();

		await runner.execute(timerReminderSweep());

		expect(added).toHaveLength(1);
		expect(added[0].queueName).toBe('timer-reminder');
		expect(added[0].jobName).toBe('timer-reminder.sweep');
		expect(added[0].options?.deduplication).toEqual({ id: 'timer-reminder.sweep.schedule' });
		expect(added[0].options?.jobId).toBeUndefined();
	});

	it("keeps the schedule's own job options", async () => {
		const { runner, added } = runnerWithQueue();
		const retried = timerReminderSweep({
			queueJobOptions: {
				attempts: 3,
				backoff: { type: 'exponential', delay: 1000 },
				removeOnComplete: true,
				removeOnFail: 20
			}
		});

		await runner.execute(retried);

		expect(added[0].options).toEqual({
			attempts: 3,
			backoff: { type: 'exponential', delay: 1000 },
			removeOnComplete: true,
			removeOnFail: 20,
			deduplication: { id: 'timer-reminder.sweep.schedule' }
		});
	});

	it('deduplicates a schedule that declares no job options of its own', async () => {
		const { runner, added } = runnerWithQueue();

		await runner.execute(timerReminderSweep({ queueJobOptions: undefined }));

		expect(added[0].options).toEqual({ deduplication: { id: 'timer-reminder.sweep.schedule' } });
	});

	it('gives every tick of a schedule the same deduplication id, and each schedule its own', async () => {
		const { runner, added } = runnerWithQueue();
		const heartbeat: DiscoveredScheduledJob = {
			id: 'worker.heartbeat.scheduler',
			providerName: 'WorkerLifecycleJob',
			methodName: 'heartbeat',
			options: jobOptions({ queueName: 'worker-default', queueJobName: 'worker.heartbeat' }),
			handler: async () => ({ timestamp: new Date().toISOString() })
		};

		await runner.execute(timerReminderSweep());
		await runner.execute(timerReminderSweep());
		await runner.execute(heartbeat);

		expect(added.map((job) => job.options?.deduplication)).toEqual([
			{ id: 'timer-reminder.sweep.schedule' },
			{ id: 'timer-reminder.sweep.schedule' },
			{ id: 'worker.heartbeat.scheduler' }
		]);
	});

	it('keeps a deduplication the schedule sets itself', async () => {
		const { runner, added } = runnerWithQueue();
		const ownDeduplication = { id: 'own-key', ttl: 5000 };

		await runner.execute(timerReminderSweep({ queueJobOptions: { deduplication: ownDeduplication } }));

		expect(added[0].options?.deduplication).toEqual(ownDeduplication);
	});

	it('adds nothing for a schedule that runs in its own process', async () => {
		const { runner, added } = runnerWithQueue();
		let ran = false;

		await runner.execute({
			id: 'in-process',
			providerName: 'InProcessJob',
			methodName: 'run',
			options: jobOptions(),
			handler: async () => {
				ran = true;
			}
		});

		expect(ran).toBe(true);
		expect(added).toHaveLength(0);
	});
});
