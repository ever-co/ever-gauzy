import { isDocsQueueEnabled, isDocsQueueWorkerEnabled } from './docs.config';

/**
 * The queue gate decides whether `DocsModule` registers the `docs-processing` BullMQ queue and
 * the `DocsProcessingWorker` `@Processor`.
 *
 * It is covered on its own because getting it wrong does not degrade a feature — it takes the
 * whole API down. `@nestjs/bullmq`'s registrar builds a `Worker` for every `@Processor` during
 * `onModuleInit`, and with no `BullModule.forRoot()` connection in the process that constructor
 * throws `Worker requires a connection`, failing the Nest bootstrap. That is exactly what
 * happened when the default was a bare `REDIS_ENABLED === 'true'`: Redis was reachable in the
 * deployed environments, but no process that loaded the plugin list registered a Bull root, so
 * the API crash-looped.
 *
 * The default is now derived from `isSchedulerQueueRootEnabled()` — the SAME expression that
 * `@gauzy/core`'s `AppModule`, its `SeederModule.forPlugins()` and `apps/worker`'s `AppModule`
 * each evaluate to decide whether to register a root. The distinction the old comment protected
 * is therefore intact: the gate still answers "does a root exist in this process?", it just has
 * a truthful way to answer it now instead of defaulting to "no".
 */
describe('isDocsQueueEnabled', () => {
	const ORIGINAL = { ...process.env };

	// 🛑 Nx feeds `.env` / `.env.local` into every task, so a developer's own
	// `WORKER_QUEUE_ENABLED=false` (or `REDIS_ENABLED`) reaches jest and silently flips this gate.
	// Start from a clean slate; each test then states the environment it asserts about.
	beforeEach(() => {
		delete process.env['REDIS_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		delete process.env['WORKER_QUEUE_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'];
	});

	afterEach(() => {
		process.env = { ...ORIGINAL };
	});

	it('is OFF when nothing is configured, so the pipeline dispatches inline', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		delete process.env['REDIS_ENABLED'];

		expect(isDocsQueueEnabled()).toBe(false);
	});

	it('turns ON when Redis is enabled, because that is when a root is registered', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		process.env['REDIS_ENABLED'] = 'true';

		// Safe now, and ONLY because every module that builds a plugin-hosting graph registers
		// `SchedulerModule.forRoot({ enableQueueing: true })` under this very same condition.
		expect(isDocsQueueEnabled()).toBe(true);
	});

	it('stays OFF when the shared root switch is off, even with Redis enabled', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		process.env['SCHEDULER_QUEUE_ENABLED'] = 'false';
		process.env['REDIS_ENABLED'] = 'true';

		// No root is registered in this configuration, so a `@Processor` here would be the
		// `Worker requires a connection` crash all over again.
		expect(isDocsQueueEnabled()).toBe(false);
	});

	/**
	 * REGRESSION — this configuration crash-looped a real worker boot during verification: the
	 * worker registered no root (its `WORKER_QUEUE_ENABLED=false`) while this gate still said
	 * "queued", and `SchedulerJobRegistryService` refused the docs reconcile job with
	 * `targets queue "docs-processing" but queueing is disabled`.
	 */
	it('stays OFF when the worker-local WORKER_QUEUE_ENABLED removes the root', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		process.env['REDIS_ENABLED'] = 'true';
		process.env['WORKER_QUEUE_ENABLED'] = 'false';

		expect(isDocsQueueEnabled()).toBe(false);
	});

	it('an explicit true wins where no root would otherwise exist', () => {
		process.env['GAUZY_DOCS_QUEUE_ENABLED'] = 'true';
		delete process.env['REDIS_ENABLED'];

		expect(isDocsQueueEnabled()).toBe(true);
	});

	it('an explicit false wins over anything else in the environment', () => {
		process.env['GAUZY_DOCS_QUEUE_ENABLED'] = 'false';
		process.env['REDIS_ENABLED'] = 'true';

		expect(isDocsQueueEnabled()).toBe(false);
	});
});

/**
 * The consumer half. It exists so the API can enqueue without also executing the stages, which
 * is the entire point of deploying `apps/worker`.
 */
describe('isDocsQueueWorkerEnabled', () => {
	const ORIGINAL = { ...process.env };

	// 🛑 Nx feeds `.env` / `.env.local` into every task, so a developer's own
	// `WORKER_QUEUE_ENABLED=false` (or `REDIS_ENABLED`) reaches jest and silently flips this gate.
	// Start from a clean slate; each test then states the environment it asserts about.
	beforeEach(() => {
		delete process.env['REDIS_ENABLED'];
		delete process.env['SCHEDULER_QUEUE_ENABLED'];
		delete process.env['WORKER_QUEUE_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'];
	});

	afterEach(() => {
		process.env = { ...ORIGINAL };
	});

	it('follows the queue gate by default, so a single-process deployment drains its own queue', () => {
		delete process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		process.env['REDIS_ENABLED'] = 'true';

		expect(isDocsQueueWorkerEnabled()).toBe(true);
	});

	it('can be turned off on its own to make a process a pure producer', () => {
		process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'] = 'false';
		process.env['REDIS_ENABLED'] = 'true';

		expect(isDocsQueueEnabled()).toBe(true);
		expect(isDocsQueueWorkerEnabled()).toBe(false);
	});

	it('is never ON without the queue — a @Processor without a root fails the bootstrap', () => {
		process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'] = 'true';
		process.env['GAUZY_DOCS_QUEUE_ENABLED'] = 'false';
		process.env['REDIS_ENABLED'] = 'true';

		expect(isDocsQueueWorkerEnabled()).toBe(false);
	});

	it('is OFF wherever no root exists at all', () => {
		delete process.env['GAUZY_DOCS_QUEUE_WORKER_ENABLED'];
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['REDIS_ENABLED'];

		expect(isDocsQueueWorkerEnabled()).toBe(false);
	});
});
