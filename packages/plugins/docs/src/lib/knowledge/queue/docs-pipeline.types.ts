import { Job } from 'bullmq';
import { IDocsJobBase } from './docs-job.types';

/**
 * Injection token of the inline pipeline runner.
 *
 * `DocsQueueService` resolves the runner through this token **lazily** (`ModuleRef`) instead
 * of importing `DocsPipelineService` directly: the pipeline injects the queue service (to
 * chain the next stage), so a constructor-level dependency in the other direction would be a
 * DI cycle — and even a plain `import` of the class would be a CommonJS require cycle that
 * can null out `design:paramtypes` metadata depending on module load order.
 */
export const DOCS_PIPELINE_RUNNER = 'DOCS_PIPELINE_RUNNER';

/**
 * How many attempts an INLINE stage run gets.
 *
 * Deliberately **1**: inline mode has no Redis to hold a delayed retry, so a 120 s-base
 * exponential backoff would mean parking a live promise (and its DB handles) for minutes
 * inside the API process. One immediate attempt, then the failure dead-letters onto the
 * document row (`FAILED` + `statusMessage`) exactly like the queue's final attempt does —
 * and the recovery scan (`DocsRecoveryService`, which also runs in an API process via
 * `DocsPlugin.onPluginBootstrap`) re-drives stale rows later.
 */
export const DOCS_INLINE_JOB_ATTEMPTS = 1;

/**
 * The minimal job surface the `docs-processing` stage handlers actually need.
 *
 * A BullMQ `Job` satisfies it through {@link fromBullJob}; the inline runner synthesizes one
 * through {@link inlineStageJob}. Keeping the handlers on this interface (instead of on
 * `Job`) is what lets the SAME stage code back both the BullMQ worker host and the in-process
 * fallback — there is exactly one definition of every stage.
 */
export interface IDocsStageJob<T = IDocsJobBase> {
	/** Job id — seeds the deterministic per-run suffix of the chained next stage. */
	readonly id?: string;
	/** The stage payload, carrying the tenant/organization snapshot. */
	readonly data: T;
	/** Attempts configured for this run (queue: `DOCS_JOB_ATTEMPTS`; inline: 1). */
	readonly attempts: number;
	/** Attempts already made, 0-based. */
	readonly attemptsMade: number;
	/** Skip the remaining attempts (permanent errors). A no-op inline — there are none. */
	discard(): Promise<void> | void;
}

/**
 * The contract `DocsQueueService` drives in inline mode. Implemented by `DocsPipelineService`
 * and bound to {@link DOCS_PIPELINE_RUNNER}.
 */
export interface IDocsPipelineRunner {
	/**
	 * Runs one stage and NEVER rejects: failures are routed through the same dead-letter
	 * path the queue handlers use.
	 */
	runStageSafely(jobName: string, job: IDocsStageJob): Promise<void>;
}

/**
 * Adapts a BullMQ job to the stage-job surface.
 *
 * @param job The BullMQ job handed to a `@QueueJobHandler` method.
 * @returns The stage-job view of it (retry policy and `discard()` preserved).
 */
export function fromBullJob<T>(job: Job<T>): IDocsStageJob<T> {
	return {
		id: job.id,
		data: job.data,
		attempts: job.opts?.attempts ?? 1,
		attemptsMade: job.attemptsMade ?? 0,
		discard: () => job.discard()
	};
}

/**
 * Builds the synthetic stage job of an INLINE run.
 *
 * @param jobId The id the enqueue site would have used — it seeds the chained-stage suffix,
 *              so a chain started from a run-unique id stays run-unique.
 * @param data The stage payload.
 * @returns A single-attempt stage job whose `discard()` is a no-op.
 */
export function inlineStageJob<T>(jobId: string, data: T): IDocsStageJob<T> {
	return {
		id: jobId,
		data,
		attempts: DOCS_INLINE_JOB_ATTEMPTS,
		attemptsMade: 0,
		discard: () => undefined
	};
}
