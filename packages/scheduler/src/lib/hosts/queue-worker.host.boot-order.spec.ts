import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import { BullModule } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnModuleInit, Scope, Type } from '@nestjs/common';
import { CommandBus, CommandHandler, CommandHandlerNotFoundException, CqrsModule, ICommandHandler } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue, Worker } from 'bullmq';
import { QUEUE_WORKER_DEFERRED_START_METADATA } from '../constants/scheduler.constants';
import { QueueJobHandler } from '../decorators/queue-job-handler.decorator';
import { QueueWorker } from '../decorators/queue-worker.decorator';
import { QueueWorkerHost } from './queue-worker.host';

/**
 * Seen on stage 2026-10-24: a `TokenCleanupWorker` job that was already waiting in Redis while the worker
 * app booted failed with `CommandHandlerNotFoundException … CleanupExpiredTokensCommand`.
 *
 * `@nestjs/bullmq` creates every `Worker` in `onModuleInit`, and BullMQ starts fetching in the constructor
 * unless `autorun` is `false` — while `CqrsModule` registers its handlers in `onApplicationBootstrap`, a whole
 * lifecycle phase later. These cases boot a real Nest application context with the real `@nestjs/bullmq`
 * explorer and the real `CqrsModule`; only the Redis-backed classes are replaced (`BullModule.workerClass` /
 * `queueClass`), by fakes that behave like BullMQ where it matters: the fake worker holds one job that was
 * waiting before boot, starts its loop in the constructor unless `autorun: false`, and processes the job as
 * soon as the loop runs.
 */

/** The keys `@nestjs/bullmq`'s `Processor` writes under (its constants are not exported). */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';
const WORKER_METADATA = 'bullmq:worker_metadata';

const JOB_NAME = 'tokens.cleanup.expired';

/** What happened during a boot, in order. The fake worker, the command bus and a probe write here. */
let timeline: string[] = [];

type Outcome = { status: 'completed'; result: unknown } | { status: 'failed'; error: unknown };

/** BullMQ's `Worker`, minus Redis. */
class FakeWorker extends EventEmitter {
	static instances: FakeWorker[] = [];

	readonly outcomes: Outcome[] = [];
	runCalls = 0;
	closeCalls = 0;
	closing: Promise<void> | undefined;
	private running = false;
	/** A job that was already waiting in the queue when the process booted. */
	private readonly waiting: Job[] = [{ name: JOB_NAME, data: {} } as unknown as Job];

	constructor(
		readonly name: string,
		private readonly processor: (job: Job, token?: string) => Promise<unknown>,
		readonly opts: Record<string, unknown> = {}
	) {
		super();
		FakeWorker.instances.push(this);
		// BullMQ: `autorun` defaults to true, and the loop starts right here, in the constructor.
		if (opts['autorun'] ?? true) {
			this.run().catch((error) => this.emit('error', error));
		}
	}

	isRunning(): boolean {
		return this.running;
	}

	async run(): Promise<void> {
		if (this.running) {
			throw new Error('Worker is already running.');
		}
		this.running = true;
		this.runCalls++;
		timeline.push(`run:${this.name}`);

		while (!this.closing && this.waiting.length > 0) {
			const job = this.waiting.shift() as Job;
			try {
				const result = await this.processor(job, 'lock-token');
				this.outcomes.push({ status: 'completed', result });
				timeline.push(`completed:${this.name}`);
			} catch (error) {
				this.outcomes.push({ status: 'failed', error });
				timeline.push(`failed:${this.name}`);
			}
		}
	}

	async close(): Promise<void> {
		this.closeCalls++;
		this.closing = this.closing ?? Promise.resolve();
		this.running = false;
		return this.closing;
	}
}

/** BullMQ's `Queue`, minus Redis. `@nestjs/bullmq` reads `opts` and closes it on shutdown. */
class FakeQueue {
	constructor(
		readonly name: string,
		readonly opts: Record<string, unknown> = {}
	) {}

	async close(): Promise<void> {
		return undefined;
	}
}

class CleanupExpiredTokensCommand {}

@CommandHandler(CleanupExpiredTokensCommand)
class CleanupExpiredTokensHandler implements ICommandHandler<CleanupExpiredTokensCommand> {
	async execute(): Promise<number> {
		return 3;
	}
}

/** Shaped like `TokenCleanupWorker`: a job handler that dispatches a command. */
@Injectable()
@QueueWorker('token-maintenance')
class TokenCleanupWorkerLike extends QueueWorkerHost {
	constructor(private readonly commandBus: CommandBus) {
		super();
	}

	@QueueJobHandler(JOB_NAME)
	async handleExpired(): Promise<number> {
		return this.commandBus.execute(new CleanupExpiredTokensCommand());
	}
}

/** The same worker with the old behaviour opted back into: the loop starts when the worker is created. */
@Injectable()
@QueueWorker('token-maintenance-eager', { autorun: true })
class EagerTokenCleanupWorker extends QueueWorkerHost {
	constructor(private readonly commandBus: CommandBus) {
		super();
	}

	@QueueJobHandler(JOB_NAME)
	async handleExpired(): Promise<number> {
		return this.commandBus.execute(new CleanupExpiredTokensCommand());
	}
}

/** The same worker declared with an explicit `autorun: false`: held on purpose, for its owner to start. */
@Injectable()
@QueueWorker('token-maintenance-held', { autorun: false })
class HeldTokenCleanupWorker extends QueueWorkerHost {
	constructor(private readonly commandBus: CommandBus) {
		super();
	}

	@QueueJobHandler(JOB_NAME)
	async handleExpired(): Promise<number> {
		return this.commandBus.execute(new CleanupExpiredTokensCommand());
	}
}

/** Lives in the root module, whose `onModuleInit` is the last one of the module-init phase. */
@Injectable()
class EndOfModuleInitProbe implements OnModuleInit {
	onModuleInit(): void {
		timeline.push('module-init:done');
	}
}

/** Boots `worker` the way a feature module hosts one: next to its command handler, importing `CqrsModule`. */
async function boot(worker: Type<QueueWorkerHost>, queueName: string): Promise<TestingModule> {
	@Module({ imports: [CqrsModule], providers: [CleanupExpiredTokensHandler, worker] })
	class FeatureModule {}

	const moduleRef = await Test.createTestingModule({
		imports: [
			BullModule.forRoot({ connection: { host: '127.0.0.1', port: 6379 } }),
			BullModule.registerQueue({ name: queueName }),
			FeatureModule
		],
		providers: [EndOfModuleInitProbe]
	}).compile();

	await moduleRef.init();
	// Let the loop the bootstrap hook started hand its job over and settle.
	await new Promise((resolve) => setImmediate(resolve));
	return moduleRef;
}

/** Attaches a worker to a host the way `@nestjs/bullmq`'s explorer does. */
function attach(host: QueueWorkerHost, worker: FakeWorker): void {
	(host as unknown as { _worker: unknown })._worker = worker;
}

describe('QueueWorkerHost — no job is processed before the application has bootstrapped', () => {
	let moduleRef: TestingModule | undefined;
	let log: jest.SpyInstance;

	beforeEach(() => {
		timeline = [];
		FakeWorker.instances = [];
		// `registerQueue()` captures the classes when it is called, so they are swapped before each boot.
		BullModule.queueClass = FakeQueue;
		BullModule.workerClass = FakeWorker;

		log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		const register = CommandBus.prototype.register;
		jest.spyOn(CommandBus.prototype, 'register').mockImplementation(function (
			this: CommandBus,
			...args: Parameters<CommandBus['register']>
		) {
			timeline.push('cqrs:handlers-registered');
			return register.apply(this, args);
		});
	});

	afterEach(async () => {
		await moduleRef?.close();
		moduleRef = undefined;
		BullModule.queueClass = Queue;
		BullModule.workerClass = Worker;
		jest.restoreAllMocks();
	});

	it('creates the worker held, and starts it only after the CQRS handlers are registered', async () => {
		moduleRef = await boot(TokenCleanupWorkerLike, 'token-maintenance');

		const [worker] = FakeWorker.instances;
		expect(FakeWorker.instances).toHaveLength(1);
		// What `@QueueWorker()` registered reached the real explorer and, through it, the worker's constructor.
		expect(worker.opts['autorun']).toBe(false);

		// Nothing ran during the module-init phase; the loop started after `CqrsModule` registered its handlers.
		const at = (entry: string) => timeline.indexOf(entry);
		expect(at('run:token-maintenance')).toBeGreaterThan(at('module-init:done'));
		expect(at('run:token-maintenance')).toBeGreaterThan(at('cqrs:handlers-registered'));
		expect(at('cqrs:handlers-registered')).toBeGreaterThan(-1);

		// …so the job that was waiting is processed against a populated command bus.
		expect(worker.outcomes).toEqual([{ status: 'completed', result: 3 }]);
		expect(worker.runCalls).toBe(1);
		expect(log.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
			'Consuming queue "token-maintenance" in TokenCleanupWorkerLike'
		);
	});

	it('reproduces the stage failure when a worker starts at creation (explicit `autorun: true`)', async () => {
		// The control: the harness would catch a regression to the old behaviour.
		moduleRef = await boot(EagerTokenCleanupWorker, 'token-maintenance-eager');

		const [worker] = FakeWorker.instances;
		const at = (entry: string) => timeline.indexOf(entry);
		// The loop started inside the module-init phase, long before `CqrsModule` registered anything…
		expect(at('run:token-maintenance-eager')).toBeGreaterThan(-1);
		expect(at('run:token-maintenance-eager')).toBeLessThan(at('module-init:done'));
		expect(at('run:token-maintenance-eager')).toBeLessThan(at('cqrs:handlers-registered'));

		// …so the waiting job looked its command up on an empty bus, exactly as on stage.
		expect(worker.outcomes).toHaveLength(1);
		const [outcome] = worker.outcomes;
		expect(outcome.status).toBe('failed');
		expect(outcome.status === 'failed' && outcome.error).toBeInstanceOf(CommandHandlerNotFoundException);
		// The bootstrap hook leaves an already-running worker alone instead of starting it twice.
		expect(worker.runCalls).toBe(1);
	});

	it('leaves a worker declared with an explicit `autorun: false` stopped, for its owner to start', async () => {
		moduleRef = await boot(HeldTokenCleanupWorker, 'token-maintenance-held');

		const [worker] = FakeWorker.instances;
		expect(worker.opts['autorun']).toBe(false);
		// Bootstrap completed and the bootstrap hook ran, but it does not start a worker held on purpose.
		expect(timeline).toContain('cqrs:handlers-registered');
		expect(timeline).not.toContain('run:token-maintenance-held');
		expect(worker.runCalls).toBe(0);
		expect(worker.outcomes).toEqual([]);
	});

	it('still closes the worker on shutdown', async () => {
		moduleRef = await boot(TokenCleanupWorkerLike, 'token-maintenance');
		const [worker] = FakeWorker.instances;

		await moduleRef.close();
		moduleRef = undefined;

		expect(worker.closeCalls).toBe(1);
	});
});

describe('QueueWorkerHost.startConsuming', () => {
	const host = () => new TokenCleanupWorkerLike({} as CommandBus);
	const held = () => new FakeWorker('token-maintenance', async () => undefined, { autorun: false });

	beforeEach(() => {
		timeline = [];
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('starts a held worker once, however often it is called', () => {
		const subject = host();
		const worker = held();
		attach(subject, worker);

		expect(subject.startConsuming()).toBe(true);
		expect(subject.startConsuming()).toBe(false);
		expect(worker.runCalls).toBe(1);
	});

	it('does not start a worker that is already closing (shutdown during boot)', () => {
		const subject = host();
		const worker = held();
		attach(subject, worker);
		worker.closing = Promise.resolve();

		subject.onApplicationBootstrap();

		expect(worker.runCalls).toBe(0);
	});

	it('never starts a worker declared with an explicit `autorun: false`', () => {
		const subject = new HeldTokenCleanupWorker({} as CommandBus);
		const worker = held();
		attach(subject, worker);

		subject.onApplicationBootstrap();
		expect(subject.startConsuming()).toBe(false);
		expect(worker.runCalls).toBe(0);
	});

	it('does nothing, and does not throw, where no worker was attached (no BullMQ root in the process)', () => {
		const subject = host();

		expect(() => subject.onApplicationBootstrap()).not.toThrow();
		expect(subject.startConsuming()).toBe(false);
	});
});

describe('@QueueWorker — the worker options it registers', () => {
	it('holds the worker (`autorun: false`) and leaves the processor metadata as `@Processor` writes it', () => {
		@QueueWorker('q-default')
		class Subject extends QueueWorkerHost {}

		expect(Reflect.getMetadata(WORKER_METADATA, Subject)).toEqual({ autorun: false });
		expect(Reflect.getMetadata(PROCESSOR_METADATA, Subject)).toEqual({ name: 'q-default' });
		// …and records that the hold is its own doing, so `QueueWorkerHost` starts it after bootstrap.
		expect(Reflect.getMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, Subject)).toBe(true);
	});

	it('keeps every option the caller passed', () => {
		@QueueWorker('q-concurrency', { concurrency: 4 })
		class Subject extends QueueWorkerHost {}

		expect(Reflect.getMetadata(WORKER_METADATA, Subject)).toEqual({ concurrency: 4, autorun: false });
	});

	it.each([true, false])('keeps an explicit `autorun: %s`', (autorun) => {
		@QueueWorker('q-explicit', { autorun })
		class Subject extends QueueWorkerHost {}

		expect(Reflect.getMetadata(WORKER_METADATA, Subject)).toEqual({ autorun });
		// The caller owns the start: `QueueWorkerHost` leaves it alone either way.
		expect(Reflect.getMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, Subject)).toBe(false);
	});

	it('does not let a subclass that holds its worker on purpose inherit its parent’s deferred start', () => {
		@QueueWorker('q-parent')
		class Parent extends QueueWorkerHost {}
		@QueueWorker('q-child', { autorun: false })
		class Child extends Parent {}

		expect(Reflect.getMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, Parent)).toBe(true);
		expect(Reflect.getMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, Child)).toBe(false);
	});

	it('accepts processor options, like `@Processor`', () => {
		@QueueWorker({ name: 'q-options' })
		class Subject extends QueueWorkerHost {}

		expect(Reflect.getMetadata(PROCESSOR_METADATA, Subject)).toEqual({ name: 'q-options' });
		expect(Reflect.getMetadata(WORKER_METADATA, Subject)).toEqual({ autorun: false });
	});

	it('keeps BullMQ’s default for a request-scoped host, which never receives `onApplicationBootstrap`', () => {
		@QueueWorker({ name: 'q-request', scope: Scope.REQUEST })
		class Subject extends QueueWorkerHost {}

		expect(Reflect.getMetadata(WORKER_METADATA, Subject)).toBeUndefined();
		expect(Reflect.getMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, Subject)).toBe(false);
	});
});
