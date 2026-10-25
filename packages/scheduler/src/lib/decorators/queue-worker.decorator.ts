import { Processor, ProcessorOptions } from '@nestjs/bullmq';
import { applyDecorators, Scope, SetMetadata } from '@nestjs/common';
import { QUEUE_WORKER_DEFERRED_START_METADATA } from '../constants/scheduler.constants';

/**
 * The BullMQ worker options `@QueueWorker()` takes as its second argument (`@nestjs/bullmq` does not export
 * the type by name; it is the `workerOptions` parameter of `Processor`).
 */
export type QueueWorkerOptions = NonNullable<Parameters<typeof Processor>[1]>;

/**
 * The worker options a `@QueueWorker()` host is actually registered with.
 *
 * 🛑 **A queue worker does not start consuming when it is created.** `@nestjs/bullmq` creates every
 * `Worker` in `onModuleInit`, and BullMQ starts the fetch loop in the constructor unless `autorun` is
 * `false`. That is before any `onApplicationBootstrap` hook has run — and `CqrsModule` registers the
 * command, query and event handlers in exactly that hook. A job already waiting in Redis while the
 * process booted was therefore fetched and processed against an empty `CommandBus`: on stage
 * (2026-10-24) a queued `TokenCleanupWorker` job failed with `CommandHandlerNotFoundException` for
 * `CleanupExpiredTokensCommand` while the worker app was still starting.
 *
 * So `autorun` defaults to `false` here, and {@link QueueWorkerHost} starts the loop from its own
 * `onApplicationBootstrap` instead — once, centrally, for every host, rather than in each worker.
 *
 * Two cases are left as the caller declared them, and `QueueWorkerHost` never starts them:
 * - the caller states `autorun` itself — an explicit choice always wins. `autorun: true` starts at creation, as
 *   in BullMQ; an explicit `autorun: false` stays stopped until its owner calls `this.worker.run()`, as before;
 * - the host is declared request- or transient-scoped (`ProcessorOptions.scope`). Nest calls lifecycle
 *   hooks only on static instances, so such a host never receives `onApplicationBootstrap`, and it keeps
 *   BullMQ's default (the loop starts at creation).
 *
 * @param queueNameOrOptions The queue name or processor options passed to `@QueueWorker()`.
 * @param workerOptions The worker options passed to `@QueueWorker()`, if any.
 * @returns The worker options to register, or `undefined` when there are none to register.
 */
export function resolveQueueWorkerOptions(
	queueNameOrOptions: string | ProcessorOptions,
	workerOptions?: QueueWorkerOptions
): QueueWorkerOptions | undefined {
	if (workerOptions?.autorun !== undefined) {
		return workerOptions;
	}

	const scope = typeof queueNameOrOptions === 'object' ? queueNameOrOptions?.scope : undefined;
	if (scope !== undefined && scope !== Scope.DEFAULT) {
		return workerOptions;
	}

	return { ...(workerOptions ?? {}), autorun: false };
}

/**
 * Declares a BullMQ queue consumer: `@nestjs/bullmq`'s `@Processor()`, with the same signature, except that
 * the worker waits for the application to finish bootstrapping before it fetches its first job (see
 * {@link resolveQueueWorkerOptions}). The class must extend {@link QueueWorkerHost}, which starts it.
 */
export const QueueWorker: typeof Processor = (
	queueNameOrOptions: string | ProcessorOptions,
	workerOptions?: QueueWorkerOptions
): ClassDecorator => {
	const resolved = resolveQueueWorkerOptions(queueNameOrOptions, workerOptions);

	// Whether the hold is this decorator's doing, which is the only case `QueueWorkerHost` starts the worker in.
	// Written on every host (also as `false`), so a subclass never inherits its parent's answer.
	const startDeferred = resolved?.autorun === false && workerOptions?.autorun === undefined;
	const deferredStart = SetMetadata(QUEUE_WORKER_DEFERRED_START_METADATA, startDeferred);

	if (typeof queueNameOrOptions === 'string') {
		return applyDecorators(
			resolved ? Processor(queueNameOrOptions, resolved) : Processor(queueNameOrOptions),
			deferredStart
		);
	}

	return applyDecorators(
		resolved ? Processor(queueNameOrOptions, resolved) : Processor(queueNameOrOptions),
		deferredStart
	);
};
