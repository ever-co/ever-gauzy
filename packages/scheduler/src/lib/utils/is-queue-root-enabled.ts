/**
 * Environment override for the BullMQ **root** registration (`SchedulerModule.forRoot()` with
 * `enableQueueing: true`). Set it to `'false'` to force every process back to root-less operation
 * even where Redis is configured — the reversible kill-switch for this whole mechanism.
 */
export const ENV_SCHEDULER_QUEUE_ENABLED = 'SCHEDULER_QUEUE_ENABLED';

/**
 * The pre-existing, worker-local narrowing of the same decision (`apps/worker`'s
 * `WORKER_QUEUE_ENABLED`). It is read HERE, not only there, because a plugin gate cannot tell
 * which process it is running in — see the note in {@link isSchedulerQueueRootEnabled}.
 */
export const ENV_WORKER_QUEUE_ENABLED = 'WORKER_QUEUE_ENABLED';

/**
 * The single predicate deciding whether a process registers a BullMQ **root**
 * (`BullModule.forRoot()`, via `SchedulerModule.forRoot({ enableQueueing: true })`).
 *
 * 🛑 Why this exists as a shared helper rather than an inline `process.env` check in each app:
 * "Redis is enabled" and "a Bull root exists in THIS process" are DIFFERENT questions, and
 * conflating them crash-loops the API. `@nestjs/bullmq`'s registrar builds a `Worker` for every
 * `@Processor` at `onModuleInit`; with no root in the process that constructor throws
 * `Worker requires a connection` and the whole Nest bootstrap fails.
 *
 * The distinction is only safe to *derive* while every process that loads the plugin list agrees
 * on the answer. That is what this helper buys: it is the one expression imported by every module
 * that registers a root — `@gauzy/core`'s `AppModule` (the API), its `SeederModule.forPlugins()`
 * (the `yarn seed` CLI), and `apps/worker` — AND by the consumers that must know whether a root
 * will be there (e.g. the Documents plugin's queue gate). One expression, one answer, no drift.
 *
 * A process that does NOT register a root keeps working: `SchedulerQueueService` is simply absent
 * and callers fall back to their in-process path.
 *
 * @returns True when this deployment wants a BullMQ root in every plugin-hosting process.
 */
export function isSchedulerQueueRootEnabled(): boolean {
	// An explicit opt-out always wins, so an operator can disable queueing without touching Redis.
	if (process.env[ENV_SCHEDULER_QUEUE_ENABLED] === 'false') {
		return false;
	}
	// 🛑 `WORKER_QUEUE_ENABLED` is honoured here too, not just inside `apps/worker`. It predates
	// this helper and narrows the worker's own root; if only the worker read it, a worker started
	// with `WORKER_QUEUE_ENABLED=false` would have NO root while a plugin gate — which cannot tell
	// which process it is in — still answered "a root exists", and the plugin would register a
	// `@Processor`/queue-targeted job against a connection that was never created. That is not
	// hypothetical: it crash-looped a real worker boot during verification with
	// `Job "docs-reconcile-schedule" targets queue "docs-processing" but queueing is disabled.`
	// Reading it globally can only ever REMOVE a root, which degrades to the in-process fallback —
	// never to a crash.
	if (process.env[ENV_WORKER_QUEUE_ENABLED] === 'false') {
		return false;
	}
	// Same convention as `apps/worker/src/app/worker.constants.ts`: a root needs a real connection,
	// so nothing is registered unless Redis is explicitly switched on for the deployment.
	return process.env['REDIS_ENABLED'] === 'true';
}
