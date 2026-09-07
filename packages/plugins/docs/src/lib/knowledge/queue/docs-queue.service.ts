import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobsOptions } from 'bullmq';
import { SchedulerQueueService } from '@gauzy/scheduler';
import {
	DOCS_BULK_IMPORT_JOB_PRIORITY,
	DOCS_JOB_ATTEMPTS,
	DOCS_JOB_BACKOFF_DELAY_MS,
	DOCS_JOB_REMOVE_ON_COMPLETE,
	DOCS_JOB_REMOVE_ON_FAIL
} from '../../docs.constants';
import { DOCS_PROCESSING_QUEUE } from './constants';
import { IDocsJobBase } from './docs-job.types';
import { DOCS_PIPELINE_RUNNER, IDocsPipelineRunner, inlineStageJob } from './docs-pipeline.types';

/**
 * The single dispatch seam of the `docs-processing` pipeline. Two modes:
 *
 * **QUEUED** — a `@gauzy/scheduler` root with queueing exists in this process, so
 * `SchedulerQueueService` resolves and every job goes to BullMQ with the standard retry policy
 * (`attempts: 3`, exponential backoff from a 120 s base, `removeOnComplete: 500` /
 * `removeOnFail: 1000`) and a deterministic job id `docs:<stage>:<documentId>` — duplicate
 * enqueues (double-click, retry races, a recovery scan overlapping a live job) coalesce in
 * Redis instead of running twice.
 *
 * **INLINE** — no scheduler root (the API never imports `SchedulerModule.forRoot`, and the
 * standalone worker app never loads the plugin list), so `SchedulerQueueService` is absent.
 * The stage is then dispatched **directly to `DocsPipelineService`**, the same handler the
 * BullMQ worker host calls, on a background task so the HTTP request is not blocked. Without
 * this the pipeline would simply never run: uploads would sit in `UPLOADED` forever.
 *
 * Inline mode trades the queue's guarantees for an in-process approximation:
 * - **coalescing** — an in-flight guard keyed on `docs:<stage>:<documentId>` so a duplicate
 *   trigger cannot run the same stage twice concurrently (Redis job-id coalescing has no
 *   in-process equivalent, and there is no retained-completed set to consult);
 * - **retries** — a single immediate attempt (`DOCS_INLINE_JOB_ATTEMPTS`), after which the
 *   failure dead-letters onto the document row (`FAILED` + `statusMessage`), never an
 *   unhandled rejection. The startup/reconcile recovery scan re-drives stale rows.
 *
 * The DB row is the source of truth in both modes.
 */
@Injectable()
export class DocsQueueService implements OnModuleInit {
	private readonly logger = new Logger(DocsQueueService.name);

	/**
	 * Deterministic stage keys (`docs:<stage>:<documentId>`) currently executing inline —
	 * the in-process stand-in for BullMQ's job-id coalescing.
	 */
	private readonly inFlight = new Set<string>();

	/** Lazily resolved inline dispatch target; `null` once resolution has failed. */
	private pipelineRunner?: IDocsPipelineRunner | null;

	/** Guard so a queue→inline degradation is reported once, not once per job. */
	private degradationReported = false;

	constructor(
		private readonly moduleRef: ModuleRef,
		// OPTIONAL BY DESIGN: `SchedulerQueueService` only exists where `SchedulerModule.forRoot()`
		// was imported, which today is `apps/worker` alone. A required dependency here makes the
		// whole API fail to bootstrap with an `UnknownDependenciesException` the moment the
		// Documents plugin is registered.
		@Optional() private readonly schedulerQueueService?: SchedulerQueueService
	) {}

	/**
	 * Announces the active dispatch mode once, at startup, so an operator can tell from the
	 * logs whether pipeline work is going to Redis or running in-process.
	 */
	onModuleInit(): void {
		if (this.schedulerQueueService) {
			this.logger.log(
				`docs-processing dispatch mode: QUEUED — jobs go to the BullMQ queue "${DOCS_PROCESSING_QUEUE}" ` +
					`(attempts=${DOCS_JOB_ATTEMPTS}, exponential backoff from ${DOCS_JOB_BACKOFF_DELAY_MS}ms).`
			);
		} else {
			this.logger.log(
				'docs-processing dispatch mode: INLINE — no @gauzy/scheduler root in this process, so pipeline ' +
					'stages run in-process on a background task (single attempt per stage, failures dead-letter ' +
					'onto the document row). Import SchedulerModule.forRoot() to use the BullMQ queue instead.'
			);
		}
	}

	/** True when this process dispatches through BullMQ rather than running stages in-process. */
	public get isQueued(): boolean {
		return Boolean(this.schedulerQueueService);
	}

	/**
	 * Dispatches one pipeline stage — to the queue when one is available, in-process otherwise.
	 *
	 * @param jobName A `DOCS_JOB_*` constant (e.g. `docs.extract`).
	 * @param payload The job payload carrying the tenant/organization snapshot.
	 * @param options Optional BullMQ option overrides (e.g. `priority` for sweeps, or an
	 *                explicit run-unique `jobId` that must bypass coalescing).
	 * @returns True when the stage was accepted (enqueued, dispatched inline, or coalesced).
	 */
	async enqueue<T extends IDocsJobBase>(jobName: string, payload: T, options: JobsOptions = {}): Promise<boolean> {
		// An explicit `options.jobId` wins — deliberate re-run sites (reprocess, reindex,
		// recovery sweeps) pass a run-unique id precisely to bypass coalescing.
		const jobId = (options.jobId as string) ?? this.jobIdFor(jobName, payload.documentId);

		if (!this.schedulerQueueService) {
			return this.dispatchInline(jobName, payload, jobId, Number(options.delay) || 0);
		}

		try {
			await this.schedulerQueueService.enqueue({
				queueName: DOCS_PROCESSING_QUEUE,
				jobName,
				data: payload,
				options: {
					jobId,
					attempts: DOCS_JOB_ATTEMPTS,
					backoff: { type: 'exponential', delay: DOCS_JOB_BACKOFF_DELAY_MS },
					removeOnComplete: DOCS_JOB_REMOVE_ON_COMPLETE,
					removeOnFail: DOCS_JOB_REMOVE_ON_FAIL,
					...this.priorityFor(payload),
					...options
				}
			});
			this.logger.log(
				`Enqueued ${jobName} for document ${payload.documentId} (tenant ${payload.tenantId}, reason ${payload.reason})`
			);
			return true;
		} catch (error) {
			// The scheduler throws here when queueing is disabled or the queue is not registered.
			// Rather than dropping the stage on the floor (the old behaviour, which relied on a
			// recovery scan that may itself never be enqueued), degrade to the inline runner.
			this.logger.error(
				`Failed to enqueue ${jobName} for document ${payload.documentId}: ${(error as Error).message}`
			);
			if (!this.degradationReported) {
				this.degradationReported = true;
				this.logger.warn(
					'docs-processing dispatch mode: degrading to INLINE — the configured queue rejected an enqueue.'
				);
			}
			return this.dispatchInline(jobName, payload, jobId, Number(options.delay) || 0);
		}
	}

	/**
	 * Default queue priority for a payload (`07-ai-knowledge.md` §3.1/§15).
	 *
	 * A bulk import (`reason: 'import'`) is background work by definition: it must never overtake
	 * an interactive upload, a page save or an explicit re-index — the fairness half that the
	 * worker's per-tenant in-flight cap cannot provide, because ordering is decided in Redis
	 * before any worker sees the job. Every other reason keeps BullMQ's default (unprioritized,
	 * served first), and an explicit `options.priority` from the caller still wins.
	 *
	 * @param payload The job payload.
	 * @returns `{ priority }` for bulk-import work, an empty object otherwise.
	 */
	private priorityFor<T extends IDocsJobBase>(payload: T): { priority?: number } {
		return payload?.reason === 'import' ? { priority: DOCS_BULK_IMPORT_JOB_PRIORITY } : {};
	}

	/**
	 * Builds the deterministic BullMQ job id for a pipeline stage + document.
	 * (`docs:<stage>:<documentId>` — an already-enqueued stage is skipped.)
	 */
	public jobIdFor(jobName: string, documentId: string): string {
		const stage = jobName.startsWith('docs.') ? jobName.slice('docs.'.length) : jobName;
		return `docs:${stage}:${documentId}`;
	}

	/**
	 * Schedules an inline stage run on a background task.
	 *
	 * Deliberately fire-and-forget: the caller is usually an HTTP request handler (upload,
	 * reprocess, reindex) which must return as soon as the work is accepted, exactly as it
	 * does when the job goes to Redis.
	 *
	 * `delayMs` is the inline stand-in for BullMQ's `delay` option — without it, a caller that
	 * parks a stage (the `FEATURE_DOCUMENTS` gate re-queuing itself) would re-dispatch on the
	 * very next tick and spin. The timer is `unref`'d so a parked stage never holds the process
	 * open, and the in-flight guard stays claimed for the whole wait so the parked stage cannot
	 * pile up behind itself.
	 *
	 * @returns True — accepted. (A coalesced duplicate is also "accepted": the stage is
	 *          already running for that document.)
	 */
	private dispatchInline<T extends IDocsJobBase>(
		jobName: string,
		payload: T,
		jobId: string,
		delayMs = 0
	): boolean {
		// `docs.reconcile` carries no document; key the guard on the stage alone.
		const key = payload?.documentId ? this.jobIdFor(jobName, payload.documentId) : jobName;

		if (this.inFlight.has(key)) {
			this.logger.log(
				`Inline ${jobName} for document ${payload?.documentId ?? 'n/a'} is already running — duplicate trigger coalesced.`
			);
			return true;
		}
		this.inFlight.add(key);

		this.logger.log(
			`Dispatching ${jobName} inline for document ${payload?.documentId ?? 'n/a'} ` +
				`(tenant ${payload?.tenantId}, reason ${payload?.reason}` +
				`${delayMs > 0 ? `, delayed ${delayMs}ms` : ''})`
		);

		// `setImmediate`/`setTimeout` (not `await`) so the request path returns straight away;
		// `void` marks the deliberate floating promise — `runInline` never rejects.
		const run = () => {
			void this.runInline(jobName, payload, jobId, key);
		};
		if (delayMs > 0) {
			setTimeout(run, delayMs).unref?.();
		} else {
			setImmediate(run);
		}
		return true;
	}

	/**
	 * Runs one inline stage to completion and clears the in-flight guard. Never rejects.
	 */
	private async runInline<T extends IDocsJobBase>(
		jobName: string,
		payload: T,
		jobId: string,
		key: string
	): Promise<void> {
		try {
			const runner = this.resolvePipelineRunner();
			if (!runner) {
				this.logger.error(
					`Inline ${jobName} for document ${payload?.documentId} could not run — the docs pipeline runner ` +
						`is not registered (expected provider token "${DOCS_PIPELINE_RUNNER}").`
				);
				return;
			}
			// `runStageSafely` owns the failure path (dead-letter onto the document row).
			await runner.runStageSafely(jobName, inlineStageJob(jobId, payload));
		} catch (error) {
			// Belt and braces — `runStageSafely` swallows stage errors, so this can only be a
			// resolution failure. An unhandled rejection here would take the process down.
			this.logger.error(
				`Inline ${jobName} failed for document ${payload?.documentId}: ${(error as Error).message}`
			);
		} finally {
			this.inFlight.delete(key);
		}
	}

	/**
	 * Resolves the pipeline runner lazily through `ModuleRef`.
	 *
	 * It cannot be a constructor dependency: `DocsPipelineService` injects THIS service to
	 * chain the next stage, so the two would form a DI cycle (and a CommonJS require cycle
	 * that can null out `design:paramtypes`). The token indirection keeps the class out of
	 * this module's import graph entirely.
	 */
	private resolvePipelineRunner(): IDocsPipelineRunner | null {
		if (this.pipelineRunner !== undefined) {
			return this.pipelineRunner;
		}
		try {
			this.pipelineRunner = this.moduleRef.get<IDocsPipelineRunner>(DOCS_PIPELINE_RUNNER, { strict: false });
		} catch {
			this.pipelineRunner = null;
		}
		return this.pipelineRunner;
	}
}
