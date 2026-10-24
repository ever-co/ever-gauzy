import { WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { QUEUE_JOB_HANDLER_METADATA } from '../constants/scheduler.constants';

type QueueJobHandler = (job: Job, token?: string) => Promise<unknown> | unknown;

// Module-level rather than a field: a subclass declaring its own `logger` must not collide with the host's.
const logger = new Logger('QueueWorkerHost');

export abstract class QueueWorkerHost extends WorkerHost implements OnApplicationBootstrap {
	private handlerMap?: Map<string, QueueJobHandler>;

	/**
	 * Starts this host's BullMQ worker once the application has bootstrapped.
	 *
	 * `@QueueWorker()` registers the worker with `autorun: false`, so the `Worker` `@nestjs/bullmq` creates in
	 * `onModuleInit` holds still until here. Nest runs this hook only after every module's `onModuleInit` and
	 * after the `onApplicationBootstrap` of the modules this host's module depends on — in particular
	 * `CqrsModule`'s, which is where the command, query and event handlers a job dispatches to are
	 * registered. A job that was waiting in Redis while the process booted is no longer fetched against an
	 * empty `CommandBus` (`CommandHandlerNotFoundException`, seen on stage 2026-10-24 for
	 * `CleanupExpiredTokensCommand`).
	 *
	 * This is the same in every process that hosts consumers (`apps/worker`, the API, the seeder): each
	 * starts its workers from this hook, after `app.init()` has run the module-init phase.
	 *
	 * Shutdown is unchanged: `@nestjs/bullmq` closes every worker it created in `onApplicationShutdown`,
	 * whether or not it was started.
	 *
	 * 🛑 A subclass that implements `onApplicationBootstrap` itself must call `super.onApplicationBootstrap()`,
	 * or its worker never consumes.
	 */
	onApplicationBootstrap(): void {
		this.startConsuming();
	}

	/**
	 * Starts the worker's fetch loop if it is attached, not already running and not closing.
	 *
	 * Safe to call more than once. Exposed for the one case the bootstrap hook cannot cover: a host whose
	 * worker is attached after bootstrap (`BullModule.forRoot({ extraOptions: { manualRegistration: true } })`
	 * followed by `BullRegistrar.register()`), which should call this once it has registered.
	 *
	 * @returns True when this call started the loop.
	 */
	startConsuming(): boolean {
		const worker = this.resolveAttachedWorker();

		// No worker: this process has no BullMQ root, or registers its workers manually. Nothing to start.
		if (!worker) {
			return false;
		}

		// Already running (an explicit `autorun: true`, or a second call), or shutting down: leave it alone.
		if (worker.isRunning() || worker.closing) {
			return false;
		}

		// The loop resolves only when the worker closes, so it is never awaited here. A loop that cannot
		// start is reported on the worker's `error` event — the same path BullMQ's own `autorun` takes.
		void worker.run().catch((error: unknown) => worker.emit('error', error as Error));

		logger.log(`Consuming queue "${worker.name}" in ${this.constructor.name} (application bootstrapped).`);
		return true;
	}

	async process(job: Job, token?: string): Promise<unknown> {
		const handler = this.getHandlers().get(job.name);

		if (!handler) {
			const available = Array.from(this.getHandlers().keys());
			throw new Error(
				`No handler found for queue job "${job.name}" in ${this.constructor.name}. Available handlers: ${available.join(', ')}`
			);
		}

		return handler(job, token);
	}

	/**
	 * The worker `@nestjs/bullmq` attached to this host, or `undefined` when none was (the `worker` getter
	 * throws in that case).
	 */
	private resolveAttachedWorker(): Worker | undefined {
		try {
			return this.worker;
		} catch {
			return undefined;
		}
	}

	private getHandlers(): Map<string, QueueJobHandler> {
		if (this.handlerMap) {
			return this.handlerMap;
		}

		const handlers = new Map<string, QueueJobHandler>();
		const prototype = Object.getPrototypeOf(this) as Record<string, unknown>;
		const methodNames = Object.getOwnPropertyNames(prototype);

		for (const methodName of methodNames) {
			if (methodName === 'constructor') {
				continue;
			}

			const methodRef = prototype[methodName];
			if (typeof methodRef !== 'function') {
				continue;
			}

			const handlerName = Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, methodRef) as string | undefined;
			if (!handlerName) {
				continue;
			}

			if (handlers.has(handlerName)) {
				throw new Error(`Duplicate queue job handler "${handlerName}" in ${this.constructor.name}.`);
			}

			const target = this as unknown as Record<string, QueueJobHandler>;
			handlers.set(handlerName, (job: Job, token?: string) => target[methodName](job, token));
		}

		this.handlerMap = handlers;
		return handlers;
	}
}
