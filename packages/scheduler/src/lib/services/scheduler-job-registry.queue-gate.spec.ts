import 'reflect-metadata';
import { SchedulerJobRegistryService } from './scheduler-job-registry.service';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { ScheduledJobOptions } from '../interfaces/scheduled-job-options.interface';

/**
 * A `@ScheduledJob({ queueName })` that lands in a process WITHOUT queueing used to throw from
 * `resolveJobOptions`, and that throw ran inside `SchedulerDiscoveryService.onModuleInit` — so it
 * aborted the whole Nest bootstrap.
 *
 * 🛑 The consequence was not theoretical: `apps/worker` could not boot AT ALL whenever
 * `REDIS_ENABLED` was not `true` (or `WORKER_QUEUE_ENABLED=false`), because
 * `@gauzy/plugin-docs`'s `DocsRecoveryService` is registered unconditionally — correctly, since it
 * also owns a startup recovery scan that needs no queue — and carries
 * `@ScheduledJob({ name: 'docs-reconcile-schedule', queueName: 'docs-processing' })`. One plugin's
 * optional scheduled fan-out could stop an entire process from starting. It threw even when the
 * job runner itself was disabled and the job provably could never fire.
 *
 * The job is now REGISTERED and marked unschedulable; `registerSchedules()` skips it with a
 * warning. The property that actually mattered is preserved: the job never fires and then dies at
 * enqueue, because it never fires.
 */
describe('SchedulerJobRegistryService — queue-targeting jobs where queueing is unavailable', () => {
	const moduleOptions = (overrides: Partial<ResolvedSchedulerModuleOptions> = {}): ResolvedSchedulerModuleOptions =>
		({
			enabled: true,
			enableQueueing: false,
			defaultQueueName: 'default-queue',
			logRegisteredJobs: false,
			defaultJobOptions: {
				enabled: true,
				preventOverlap: true,
				retries: 0,
				retryDelayMs: 0,
				maxRandomDelayMs: 0
			},
			...overrides
		} as ResolvedSchedulerModuleOptions);

	const register = (metadata: ScheduledJobOptions, options?: Partial<ResolvedSchedulerModuleOptions>) => {
		const registry = new SchedulerJobRegistryService(moduleOptions(options));
		return registry.register({
			providerName: 'DocsRecoveryService',
			methodName: 'reconcile',
			metadata,
			handler: async () => undefined
		});
	};

	/** The exact shape that broke `apps/worker`. */
	const RECONCILE: ScheduledJobOptions = {
		name: 'docs-reconcile-schedule',
		cron: '*/10 * * * *',
		queueName: 'docs-processing'
	};

	describe('the regression', () => {
		it('registers instead of throwing when the job runner is ON but queueing is off', () => {
			expect(() => register(RECONCILE)).not.toThrow();

			const job = register(RECONCILE);
			expect(job.id).toBe('docs-reconcile-schedule');
			expect(job.options.unschedulableReason).toContain('docs-processing');
			expect(job.options.unschedulableReason).toContain('queueing is disabled');
		});

		it('registers instead of throwing when the job runner is OFF as well', () => {
			// This is the case that is provably harmless: nothing schedules anything at all.
			expect(() => register(RECONCILE, { enabled: false })).not.toThrow();
			expect(register(RECONCILE, { enabled: false }).options.unschedulableReason).toBeDefined();
		});

		it('keeps the job introspectable rather than dropping it on the floor', () => {
			const job = register(RECONCILE);

			expect(job.options.enabled).toBe(true);
			expect(job.options.cron).toBe('*/10 * * * *');
			expect(job.options.queueName).toBe('docs-processing');
		});
	});

	describe('cases that must NOT be marked unschedulable', () => {
		it('a queue-targeting job in a process that HAS queueing', () => {
			expect(register(RECONCILE, { enableQueueing: true }).options.unschedulableReason).toBeUndefined();
		});

		it('a job that targets no queue at all', () => {
			const job = register({ name: 'plain', cron: '* * * * *' });

			expect(job.options.queueName).toBeUndefined();
			expect(job.options.unschedulableReason).toBeUndefined();
		});

		it('a job the author disabled — it is already off, the queue is irrelevant', () => {
			expect(register({ ...RECONCILE, enabled: false }).options.unschedulableReason).toBeUndefined();
		});
	});

	describe('unrelated validation still fails fast', () => {
		it('rejects a job defining both cron and intervalMs', () => {
			expect(() => register({ name: 'both', cron: '* * * * *', intervalMs: 1000 })).toThrow(
				/cannot define both/
			);
		});

		it('rejects an invalid intervalMs', () => {
			expect(() => register({ name: 'bad-interval', intervalMs: 0 })).toThrow(/invalid "intervalMs"/);
		});
	});
});
