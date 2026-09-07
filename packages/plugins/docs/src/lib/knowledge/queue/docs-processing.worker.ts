import { Injectable, Logger } from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { getDocsConfig } from '../../docs.config';
import { DOCS_TENANT_AI_CONCURRENCY, DOCS_TENANT_BUSY_DEFER_DELAY_MS } from '../../docs.constants';
import {
	DOCS_JOB_CHUNK,
	DOCS_JOB_CLASSIFY,
	DOCS_JOB_EMBED,
	DOCS_JOB_EXTRACT,
	DOCS_JOB_INDEX,
	DOCS_JOB_RECONCILE,
	DOCS_JOB_THUMBNAIL,
	DOCS_PROCESSING_QUEUE
} from './constants';
import {
	IDocsChunkJob,
	IDocsClassifyJob,
	IDocsEmbedJob,
	IDocsExtractJob,
	IDocsIndexJob,
	IDocsJobBase,
	IDocsReconcileJob,
	IDocsThumbnailJob
} from './docs-job.types';
import { DocsPipelineService } from './docs-pipeline.service';
import { fromBullJob } from './docs-pipeline.types';

/**
 * The `docs-processing` BullMQ worker host — the queue-mode **dispatcher** for the M3
 * pipeline `extract → classify → chunk → embed → index`.
 *
 * It owns no stage logic: every handler adapts the BullMQ `Job` to the transport-neutral
 * {@link import('./docs-pipeline.types').IDocsStageJob} and calls `DocsPipelineService`, the
 * single definition of each stage. The in-process fallback (`DocsQueueService` inline mode)
 * calls exactly the same methods, so the two dispatchers can never drift apart.
 *
 * Errors deliberately propagate out of these methods: BullMQ needs the rejection to apply the
 * `attempts: 3` / 120 s-base exponential backoff policy the pipeline's stage-error handler
 * relies on.
 *
 * This provider is only registered when the plugin's queue mode is enabled (see
 * `isDocsQueueEnabled()` in `docs.config.ts`) — registering a `@Processor` without a BullMQ
 * root would open a stray Redis worker connection in every API process.
 *
 * The two AI-heavy stages (`classify`, `embed`) additionally run through
 * {@link DocsProcessingWorker.serializedPerTenant} — see `07-ai-knowledge.md` §3.1/§15.
 */
@Injectable()
@QueueWorker(DOCS_PROCESSING_QUEUE, {
	concurrency: getDocsConfig().queueConcurrency
})
export class DocsProcessingWorker extends QueueWorkerHost {
	private readonly logger = new Logger(DocsProcessingWorker.name);

	/**
	 * How many AI-heavy stages each tenant currently holds on THIS worker process.
	 *
	 * Deliberately per-process and in-memory: it is a fairness valve on the provider calls this
	 * process makes, not a distributed lock, and the entry is deleted the moment the count
	 * reaches zero so the map cannot grow with the tenant table.
	 */
	private readonly aiInFlightByTenant = new Map<string, number>();

	constructor(private readonly pipeline: DocsPipelineService) {
		super();
	}

	/** `docs.extract` → {@link DocsPipelineService.handleExtract}. */
	@QueueJobHandler(DOCS_JOB_EXTRACT)
	public async handleExtract(job: Job<IDocsExtractJob>): Promise<void> {
		await this.pipeline.handleExtract(fromBullJob(job));
	}

	/**
	 * `docs.classify` → {@link DocsPipelineService.handleClassify}, serialized per tenant.
	 *
	 * @param job The stage job.
	 * @param token The BullMQ lock token — required to hand the job back to the delayed set.
	 */
	@QueueJobHandler(DOCS_JOB_CLASSIFY)
	public async handleClassify(job: Job<IDocsClassifyJob>, token?: string): Promise<void> {
		await this.serializedPerTenant(job, token, () => this.pipeline.handleClassify(fromBullJob(job)));
	}

	/** `docs.chunk` → {@link DocsPipelineService.handleChunk}. */
	@QueueJobHandler(DOCS_JOB_CHUNK)
	public async handleChunk(job: Job<IDocsChunkJob>): Promise<void> {
		await this.pipeline.handleChunk(fromBullJob(job));
	}

	/**
	 * `docs.embed` → {@link DocsPipelineService.handleEmbed}, serialized per tenant.
	 *
	 * @param job The stage job.
	 * @param token The BullMQ lock token — required to hand the job back to the delayed set.
	 */
	@QueueJobHandler(DOCS_JOB_EMBED)
	public async handleEmbed(job: Job<IDocsEmbedJob>, token?: string): Promise<void> {
		await this.serializedPerTenant(job, token, () => this.pipeline.handleEmbed(fromBullJob(job)));
	}

	/** `docs.index` → {@link DocsPipelineService.handleIndex}. */
	@QueueJobHandler(DOCS_JOB_INDEX)
	public async handleIndex(job: Job<IDocsIndexJob>): Promise<void> {
		await this.pipeline.handleIndex(fromBullJob(job));
	}

	/**
	 * `docs.thumbnail` → {@link DocsPipelineService.handleThumbnail}.
	 *
	 * The one handler here that cannot reject: the stage swallows its own failures, so BullMQ
	 * never retries a cosmetic job and never records one as failed.
	 */
	@QueueJobHandler(DOCS_JOB_THUMBNAIL)
	public async handleThumbnail(job: Job<IDocsThumbnailJob>): Promise<void> {
		await this.pipeline.handleThumbnail(fromBullJob(job));
	}

	/** `docs.reconcile` → {@link DocsPipelineService.handleReconcile}. */
	@QueueJobHandler(DOCS_JOB_RECONCILE)
	public async handleReconcile(job: Job<IDocsReconcileJob>): Promise<void> {
		await this.pipeline.handleReconcile(fromBullJob(job));
	}

	/**
	 * Runs an AI-heavy stage under the per-tenant in-flight cap of `07-ai-knowledge.md` §3.1.
	 *
	 * `concurrency` is a process budget that knows nothing about who queued the work, and the
	 * queue service's `inFlight` set is per-*document* dedupe, not fairness — so with neither of
	 * these one tenant's bulk import owns every slot and every other tenant's classification and
	 * embedding waits behind it (and behind its share of the shared provider rate limit).
	 *
	 * A tenant already at {@link DOCS_TENANT_AI_CONCURRENCY} does **not** block the worker and is
	 * **never** failed or dropped: the job is moved back to the delayed set
	 * ({@link DOCS_TENANT_BUSY_DEFER_DELAY_MS} later) and `DelayedError` tells BullMQ the handler
	 * has already re-homed it — no attempt is consumed, the lock is released, and the freed slot
	 * goes to whoever is next. Combined with the lower `priority` the queue service puts on
	 * `reason: 'import'` jobs, a 500-file import sinks below interactive work instead of starving it.
	 *
	 * @param job The stage job.
	 * @param token The BullMQ lock token, as handed to the handler by `QueueWorkerHost.process`.
	 * @param run The stage body to run while the slot is held.
	 */
	private async serializedPerTenant<T extends IDocsJobBase>(
		job: Job<T>,
		token: string | undefined,
		run: () => Promise<void>
	): Promise<void> {
		const tenantId = job?.data?.tenantId;

		// Nothing to serialize on (no tenant snapshot), or no lock token to hand the job back
		// with — `moveToDelayed` would throw and lose the stage. Run it rather than drop it.
		if (!tenantId || !token) {
			await run();
			return;
		}

		const inFlight = this.aiInFlightByTenant.get(tenantId) ?? 0;
		if (inFlight >= DOCS_TENANT_AI_CONCURRENCY) {
			this.logger.log(
				`${job.name} deferred for document ${job.data?.documentId} — tenant ${tenantId} already holds ` +
					`${inFlight}/${DOCS_TENANT_AI_CONCURRENCY} AI slot(s) on this worker; retrying in ` +
					`${DOCS_TENANT_BUSY_DEFER_DELAY_MS}ms.`
			);
			await job.moveToDelayed(Date.now() + DOCS_TENANT_BUSY_DEFER_DELAY_MS, token);
			// 🛑 BullMQ requires this exact signal: the job is already in the delayed set, so the
			// worker must neither complete nor fail it. Anything else double-handles the job.
			throw new DelayedError(
				`${job.name} deferred — tenant ${tenantId} is at the per-tenant AI concurrency cap.`
			);
		}

		this.aiInFlightByTenant.set(tenantId, inFlight + 1);
		try {
			await run();
		} finally {
			const remaining = (this.aiInFlightByTenant.get(tenantId) ?? 1) - 1;
			if (remaining > 0) {
				this.aiInFlightByTenant.set(tenantId, remaining);
			} else {
				this.aiInFlightByTenant.delete(tenantId);
			}
		}
	}
}
