import 'reflect-metadata';
import { getQueueToken } from '@nestjs/bullmq';
import { DynamicModule } from '@nestjs/common';
import { SchedulerModule } from './scheduler.module';
import { SCHEDULER_MODULE_OPTIONS } from './constants/scheduler.constants';
import { ResolvedSchedulerModuleOptions } from './interfaces/scheduler-module-options.interface';
import { isSchedulerQueueRootEnabled } from './utils/is-queue-root-enabled';

/**
 * `SchedulerModule.forRoot()` has TWO independent halves, and the API depends on being able to
 * take exactly one of them:
 *
 * - `enableQueueing` gates `BullModule.forRoot()` — the connection that makes this process able
 *   to ENQUEUE (and the reason `SchedulerQueueService` resolves at all).
 * - `enabled` gates the job-runner half: `SchedulerDiscoveryService.registerSchedules()` skips
 *   every discovered job when it is false, and `SchedulerJobRunnerService.execute()` returns
 *   before doing anything — which also neutralizes `onApplicationBootstrap`'s `runOnStart` path.
 *
 * `{ enabled: false, enableQueueing: true }` is therefore "producer-only", and these tests pin
 * that, because getting it wrong is silent: with `enabled` left at its default the API would run
 * every scheduled job a second time alongside `apps/worker`.
 */
const optionsOf = (module: DynamicModule): ResolvedSchedulerModuleOptions => {
	const provider = (module.providers ?? []).find(
		(candidate) => (candidate as { provide?: unknown }).provide === SCHEDULER_MODULE_OPTIONS
	) as { useValue: ResolvedSchedulerModuleOptions };
	return provider.useValue;
};

/**
 * A `BullModule.forRoot()` import is the only thing that provides the shared `BULLMQ_CONFIG(...)`
 * token — the connection every `Queue`/`Worker` in the process is built from. Its presence IS
 * "this process has a Bull root".
 */
const hasBullRoot = (module: DynamicModule): boolean =>
	(module.imports ?? []).some((imported) =>
		((imported as DynamicModule)?.providers ?? []).some((provider) =>
			String((provider as { provide?: unknown }).provide ?? '').startsWith('BULLMQ_CONFIG')
		)
	);

describe('SchedulerModule.forRoot — producer-only shape', () => {
	const ORIGINAL = { ...process.env };

	// 🛑 Nx feeds `.env` / `.env.local` into every task, so the developer's own
	// `WORKER_QUEUE_ENABLED=false` reaches jest and silently flips this gate. Start from a clean
	// slate and let each test state the environment it is actually asserting about.
	beforeEach(() => {
		delete process.env['REDIS_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		delete process.env['WORKER_QUEUE_ENABLED'];
	});

	afterEach(() => {
		process.env = { ...ORIGINAL };
	});

	it('registers a BullMQ root when queueing is enabled', () => {
		const module = SchedulerModule.forRoot({ enabled: false, enableQueueing: true });

		expect(optionsOf(module).enableQueueing).toBe(true);
		expect(hasBullRoot(module)).toBe(true);
	});

	it('keeps the job-runner half OFF so scheduled jobs do not run twice', () => {
		const module = SchedulerModule.forRoot({ enabled: false, enableQueueing: true });

		// `SchedulerDiscoveryService.registerSchedules()` and `SchedulerJobRunnerService.execute()`
		// both bail on this flag — no cron is created, no interval is created, no `runOnStart`.
		expect(optionsOf(module).enabled).toBe(false);
	});

	it('still exports the queue service, which is what makes the process a producer', () => {
		const module = SchedulerModule.forRoot({ enabled: false, enableQueueing: true });

		expect(module.exports).toEqual(expect.arrayContaining([expect.anything()]));
		expect((module.providers ?? []).length).toBeGreaterThan(0);
	});

	it('registers NO Bull root when queueing is disabled, so a root-less process stays root-less', () => {
		const module = SchedulerModule.forRoot({ enabled: false, enableQueueing: false });

		expect(optionsOf(module).enableQueueing).toBe(false);
		expect(hasBullRoot(module)).toBe(false);
	});

	it('drops queue registrations when queueing is off — no Queue token can leak in', () => {
		const module = SchedulerModule.forRoot({ enableQueueing: false, queues: ['docs-processing'] });

		expect(optionsOf(module).queues).toEqual([]);
		const tokens = (module.imports ?? []).flatMap((imported) =>
			((imported as DynamicModule)?.providers ?? []).map((provider) =>
				String((provider as { provide?: unknown }).provide ?? '')
			)
		);
		expect(tokens).not.toContain(String(getQueueToken('docs-processing')));
	});

	/**
	 * 🛑 The reason every caller passes `enableQueueing` EXPLICITLY instead of leaning on the
	 * default: `normalizeSchedulerModuleOptions`'s `DEFAULT_MODULE_OPTIONS` is a module-level
	 * const, so `REDIS_ENABLED` is snapshotted the first time `@gauzy/scheduler` is required.
	 * Anything that mutates the environment after that (a test, a late `dotenv` load) is invisible
	 * to the default. `isSchedulerQueueRootEnabled()` is a FUNCTION precisely so the apps and the
	 * plugin gates read the environment at the moment they build their metadata.
	 */
	it('does not re-read REDIS_ENABLED at call time — hence the explicit option everywhere', () => {
		process.env['REDIS_ENABLED'] = 'true';
		delete process.env['SCHEDULER_QUEUE_ENABLED'];

		// The helper is live...
		expect(isSchedulerQueueRootEnabled()).toBe(true);
		// ...the built-in default is not; it froze at import time (false in the test process).
		expect(optionsOf(SchedulerModule.forRoot({})).enableQueueing).toBe(false);
		// Which is why passing it explicitly is the contract the apps use.
		expect(
			optionsOf(SchedulerModule.forRoot({ enableQueueing: isSchedulerQueueRootEnabled() })).enableQueueing
		).toBe(true);
	});

	it('is declared global so plugin modules can resolve the queue service without importing it', () => {
		expect(SchedulerModule.forRoot({ enableQueueing: true }).global).toBe(true);
	});
});

describe('isSchedulerQueueRootEnabled', () => {
	const ORIGINAL = { ...process.env };

	// 🛑 Nx feeds `.env` / `.env.local` into every task, so the developer's own
	// `WORKER_QUEUE_ENABLED=false` reaches jest and silently flips this gate. Start from a clean
	// slate and let each test state the environment it is actually asserting about.
	beforeEach(() => {
		delete process.env['REDIS_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		delete process.env['WORKER_QUEUE_ENABLED'];
	});

	afterEach(() => {
		process.env = { ...ORIGINAL };
	});

	it('is off when Redis is not explicitly enabled', () => {
		delete process.env['REDIS_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];

		expect(isSchedulerQueueRootEnabled()).toBe(false);
	});

	it('is on when Redis is enabled', () => {
		process.env['REDIS_ENABLED'] = 'true';
		delete process.env['SCHEDULER_QUEUE_ENABLED'];

		expect(isSchedulerQueueRootEnabled()).toBe(true);
	});

	it('honours the explicit kill-switch over Redis being enabled', () => {
		process.env['REDIS_ENABLED'] = 'true';
		process.env['SCHEDULER_QUEUE_ENABLED'] = 'false';

		expect(isSchedulerQueueRootEnabled()).toBe(false);
	});

	/**
	 * REGRESSION. `apps/worker` narrows its own root with the older `WORKER_QUEUE_ENABLED`. When
	 * only the worker read that flag, a worker booted with `WORKER_QUEUE_ENABLED=false` and Redis
	 * on had NO root, while the Documents gate — which cannot tell which process it is in — still
	 * answered "queued". The worker then died at `onModuleInit` with
	 * `Job "docs-reconcile-schedule" targets queue "docs-processing" but queueing is disabled.`
	 *
	 * Reading it here can only ever remove a root, i.e. degrade to the in-process fallback.
	 */
	it('honours the worker-local WORKER_QUEUE_ENABLED so plugin gates cannot disagree with it', () => {
		process.env['REDIS_ENABLED'] = 'true';
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		process.env['WORKER_QUEUE_ENABLED'] = 'false';

		expect(isSchedulerQueueRootEnabled()).toBe(false);
	});

	it('is unaffected by WORKER_QUEUE_ENABLED when it is not an explicit false', () => {
		process.env['REDIS_ENABLED'] = 'true';
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		process.env['WORKER_QUEUE_ENABLED'] = 'true';

		expect(isSchedulerQueueRootEnabled()).toBe(true);
	});
});
