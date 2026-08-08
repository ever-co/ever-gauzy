import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { Document } from '../../entities/document.entity';
import { DocumentProcessingService } from '../../services/document-processing.service';
import { DocumentClassifierService } from '../classification/document-classifier.service';
import { DocumentIndexService } from '../indexing/document-index.service';
import { isTransientError } from '../errors';
import { DocumentThumbnailService } from '../thumbnail/document-thumbnail.service';
import { isThumbnailableMime } from '../thumbnail/thumbnail.constants';
import {
	DOCS_JOB_CHUNK,
	DOCS_JOB_CLASSIFY,
	DOCS_JOB_EMBED,
	DOCS_JOB_EXTRACT,
	DOCS_JOB_INDEX,
	DOCS_JOB_RECONCILE,
	DOCS_JOB_THUMBNAIL
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
import { IDocsPipelineRunner, IDocsStageJob } from './docs-pipeline.types';
import { DocsRecoveryService } from './docs-recovery.service';
import { DocsQueueService } from './docs-queue.service';

/**
 * The `docs-processing` pipeline itself — the full M3 chain
 * `extract → classify → chunk → embed → index` (plus the `reconcile` sweep).
 *
 * **This is the ONE definition of every stage.** Two dispatchers drive it:
 *
 * - `DocsProcessingWorker` — the BullMQ worker host, when a `@gauzy/scheduler` root with
 *   queueing exists in the process (today: `apps/worker`).
 * - `DocsQueueService` inline mode — when it does not (today: `apps/api`, which never imports
 *   `SchedulerModule.forRoot`). Stages then run in-process, in the background.
 *
 * Handlers take {@link IDocsStageJob}, not a BullMQ `Job`, which is exactly what lets both
 * dispatchers share this code. Everything else is unchanged from the queue-only design:
 * handlers chain the graph explicitly with a per-run idempotency suffix derived from the
 * current job id, so BullMQ retries of a stage reuse the chained ids while distinct runs get
 * fresh ones.
 *
 * AI-disabled / no-provider deployments run the lexical-only path per the degradation ladder:
 * classify no-ops, embed skips, and index records the lexical-only marker — the document
 * still reaches `INDEXED`. Nothing is ever stuck waiting on AI availability.
 *
 * Every handler re-loads the document from the explicit tenant/organization snapshot on the
 * payload; a soft-deleted or missing row logs and completes (no retry). `RequestContext` is
 * NEVER consulted here — neither queue threads nor background inline runs have one.
 */
@Injectable()
export class DocsPipelineService implements IDocsPipelineRunner {
	private readonly logger = new Logger(DocsPipelineService.name);

	constructor(
		private readonly processingService: DocumentProcessingService,
		private readonly docsQueueService: DocsQueueService,
		private readonly recoveryService: DocsRecoveryService,
		private readonly classifierService: DocumentClassifierService,
		private readonly documentIndexService: DocumentIndexService,
		private readonly thumbnailService: DocumentThumbnailService
	) {}

	/**
	 * The single dispatch table: stage name → handler.
	 *
	 * Rejections propagate — the BullMQ path needs them to drive its retry/backoff policy.
	 * Inline callers use {@link runStageSafely} instead.
	 *
	 * @param jobName A `DOCS_JOB_*` constant.
	 * @param job The stage job (BullMQ-backed or synthetic).
	 */
	public async runStage(jobName: string, job: IDocsStageJob): Promise<void> {
		switch (jobName) {
			case DOCS_JOB_EXTRACT:
				return this.handleExtract(job as IDocsStageJob<IDocsExtractJob>);
			case DOCS_JOB_CLASSIFY:
				return this.handleClassify(job as IDocsStageJob<IDocsClassifyJob>);
			case DOCS_JOB_CHUNK:
				return this.handleChunk(job as IDocsStageJob<IDocsChunkJob>);
			case DOCS_JOB_EMBED:
				return this.handleEmbed(job as IDocsStageJob<IDocsEmbedJob>);
			case DOCS_JOB_INDEX:
				return this.handleIndex(job as IDocsStageJob<IDocsIndexJob>);
			case DOCS_JOB_THUMBNAIL:
				return this.handleThumbnail(job as IDocsStageJob<IDocsThumbnailJob>);
			case DOCS_JOB_RECONCILE:
				return this.handleReconcile(job as unknown as IDocsStageJob<IDocsReconcileJob>);
			default:
				throw new Error(`No handler found for docs pipeline stage "${jobName}".`);
		}
	}

	/**
	 * Inline entry point — runs one stage and **never rejects**.
	 *
	 * Inline runs are fire-and-forget background promises, so an escaping error would be an
	 * unhandled rejection (and, worse, would leave the row stuck in `PROCESSING`/`INDEXING`).
	 * Anything the stage's own error policy did not already dead-letter is dead-lettered here,
	 * through the very same `markExtractionFailed` / `markKnowledgeFailed` path the queue
	 * handlers use.
	 *
	 * @param jobName A `DOCS_JOB_*` constant.
	 * @param job The synthetic single-attempt stage job.
	 */
	public async runStageSafely(jobName: string, job: IDocsStageJob): Promise<void> {
		try {
			await this.runStage(jobName, job);
		} catch (error) {
			await this.deadLetter(jobName, job, error);
		}
	}

	/**
	 * `docs.extract` — load blob, run the extraction registry, write `extractedText`,
	 * set `READY`, then chain classification.
	 */
	public async handleExtract(job: IDocsStageJob<IDocsExtractJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_EXTRACT);
		if (!document) {
			return;
		}

		try {
			await this.processingService.runExtraction(document, job.data);
		} catch (error) {
			await this.handleStageError(job, document, error, 'extract');
			return;
		}

		// Best-effort, and deliberately BEFORE the classification branch so every successful
		// extract gets one, whichever way the chain continues.
		await this.enqueueThumbnail(document, job);

		// Two runs skip classification and enter the knowledge chain directly:
		//  - `keepExtractedText` — the human-correction guard; and
		//  - `classify: false` — the uploader turned "Classify with AI" off (or the org
		//    default `autoClassify` is off). Resolved on the request thread; `undefined`
		//    means "no opinion" and classifies as before.
		if (job.data.keepExtractedText || job.data.classify === false) {
			this.logger.log(
				`docs.extract: skipping classification for document ${document.id} ` +
					`(${job.data.keepExtractedText ? 'extracted text preserved' : 'AI classification opted out'})`
			);
			if (this.isInKnowledgeSystem(document)) {
				await this.enqueueChained(DOCS_JOB_CHUNK, this.baseOf(job.data), job);
			}
			return;
		}
		await this.enqueueChained(DOCS_JOB_CLASSIFY, this.baseOf(job.data), job);
	}

	/**
	 * `docs.classify` — LLM classification (§5). Best-effort by spec: every outcome
	 * (classified, low-confidence, unusable, provider failure, AI disabled) continues the
	 * chain; the document is already `READY` after extract.
	 */
	public async handleClassify(job: IDocsStageJob<IDocsClassifyJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_CLASSIFY);
		if (!document) {
			return;
		}

		const outcome = await this.classifierService.classify(document, job.data);
		this.logger.log(`docs.classify outcome for document ${document.id}: ${outcome}`);

		if (this.isInKnowledgeSystem(document)) {
			await this.enqueueChained(DOCS_JOB_CHUNK, this.baseOf(job.data), job);
		}
	}

	/**
	 * `docs.chunk` — heading-aware ~512/64-token windows with locator metadata,
	 * transactional chunk replace, and the `contentHash` skip-if-unchanged short-circuit.
	 */
	public async handleChunk(job: IDocsStageJob<IDocsChunkJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_CHUNK);
		if (!document) {
			return;
		}
		if (this.knowledgeChainAborted(document, DOCS_JOB_CHUNK)) {
			return;
		}

		try {
			const result = await this.documentIndexService.runChunkStage(document, job.data);
			if (result.outcome === 'skipped-unchanged') {
				return; // already INDEXED — zero AI spend on unchanged content
			}
			await this.enqueueChained(
				DOCS_JOB_EMBED,
				{ ...this.baseOf(job.data), contentHash: result.contentHash },
				job
			);
		} catch (error) {
			await this.handleStageError(job, document, error, 'knowledge');
		}
	}

	/**
	 * `docs.embed` — provider-resolved batched `embedMany` written through the vector
	 * store as batches return; lexical-only conditions skip with `embeddingModel: null`.
	 */
	public async handleEmbed(job: IDocsStageJob<IDocsEmbedJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_EMBED);
		if (!document) {
			return;
		}
		if (this.knowledgeChainAborted(document, DOCS_JOB_EMBED)) {
			return;
		}

		try {
			const result = await this.documentIndexService.runEmbedStage(document, job.data);
			await this.enqueueChained(
				DOCS_JOB_INDEX,
				{
					...this.baseOf(job.data),
					contentHash: job.data.contentHash ?? '',
					embeddingModel: result.embeddingModel,
					embeddingDims: result.embeddingDims
				},
				job
			);
		} catch (error) {
			await this.handleStageError(job, document, error, 'knowledge');
		}
	}

	/**
	 * `docs.index` — completeness verification, `document_index_state` upsert, and the
	 * `INDEXED` flip (lexical-only runs record the sentinel model + metadata marker).
	 */
	public async handleIndex(job: IDocsStageJob<IDocsIndexJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_INDEX);
		if (!document) {
			return;
		}
		if (this.knowledgeChainAborted(document, DOCS_JOB_INDEX)) {
			return;
		}

		try {
			await this.documentIndexService.runIndexStage(document, job.data);
		} catch (error) {
			await this.handleStageError(job, document, error, 'knowledge');
		}
	}

	/**
	 * `docs.thumbnail` — grid preview for images and the first page of PDFs (§4.4).
	 *
	 * 🛑 **It cannot fail a document.** The service already swallows its own errors, and this
	 * handler swallows anything left (a snapshot load that blew up, say), because the stage
	 * runs *after* the document is `READY`: letting a resize error reach the stage-error
	 * policy would dead-letter a perfectly good upload over a missing 320px image. There is
	 * no retry worth the risk here — the next reprocess regenerates it.
	 */
	public async handleThumbnail(job: IDocsStageJob<IDocsThumbnailJob>): Promise<void> {
		try {
			const document = await this.loadOrComplete(job.data, DOCS_JOB_THUMBNAIL);
			if (!document) {
				return;
			}
			const outcome = await this.thumbnailService.generate(document, job.data);
			this.logger.log(`docs.thumbnail outcome for document ${document.id}: ${outcome}`);
		} catch (error) {
			this.logger.warn(
				`docs.thumbnail failed for document ${job.data?.documentId}: ${(error as Error).message} ` +
					'(cosmetic — the document is unaffected)'
			);
		}
	}

	/**
	 * `docs.reconcile` — the every-10-minutes recovery + model-drift sweep (also enqueued
	 * at startup).
	 */
	public async handleReconcile(job: IDocsStageJob<IDocsReconcileJob>): Promise<void> {
		this.logger.log(`Reconcile sweep requested at ${job.data?.requestedAt ?? 'unknown'}`);
		await this.recoveryService.runScan('reconcile');
	}

	/**
	 * True when the document participates in the AI knowledge system at all — i.e. its
	 * `knowledgeStatus` is neither `NONE` nor `EXCLUDED`.
	 *
	 * This, and not `=== QUEUED`, is the gate that opens the knowledge chain after extract
	 * and classify: a reprocess/re-import of an already-`INDEXED` (or `INDEXING`/`FAILED`)
	 * document re-extracts its text, and gating on `QUEUED` would leave the index holding
	 * the superseded extraction forever. `docs.chunk` still short-circuits on an unchanged
	 * `contentHash`, so a no-op reprocess costs nothing.
	 */
	private isInKnowledgeSystem(document: Document): boolean {
		return (
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.NONE &&
			document.knowledgeStatus !== DocumentKnowledgeStatusEnum.EXCLUDED
		);
	}

	/**
	 * A document excluded/reset while its knowledge chain was in flight aborts the chain
	 * silently (skipping is not an error).
	 */
	private knowledgeChainAborted(document: Document, jobName: string): boolean {
		if (!this.isInKnowledgeSystem(document)) {
			this.logger.log(
				`${jobName} skipped for document ${document.id} — knowledgeStatus is ${document.knowledgeStatus}`
			);
			return true;
		}
		return false;
	}

	/**
	 * Enqueues the next stage with a per-run idempotency suffix: BullMQ retries of the
	 * CURRENT job reuse the same chained id (duplicates coalesce), while distinct runs
	 * (forced reindex, re-import) get fresh ids and are never swallowed by a retained
	 * completed job. Inline mode has no retained set, but keeping the same id derivation
	 * means the two modes chain identically.
	 */
	private async enqueueChained<T extends IDocsJobBase>(
		jobName: string,
		payload: T,
		currentJob: IDocsStageJob
	): Promise<void> {
		const seed = `${currentJob.id ?? 'no-id'}:${jobName}`;
		const suffix = createHash('sha256').update(seed).digest('hex').slice(0, 16);
		await this.docsQueueService.enqueue(jobName, payload, {
			jobId: `${this.docsQueueService.jobIdFor(jobName, payload.documentId)}:${suffix}`
		});
	}

	/**
	 * Enqueues `docs.thumbnail` after a successful extract — best-effort in every sense.
	 *
	 * Two guards, both deliberate:
	 * - formats that cannot produce a thumbnail (docx, csv, txt, html, xlsx, and every PAGE)
	 *   are never enqueued at all, so the queue carries no work that would immediately no-op;
	 * - the enqueue itself is wrapped, because it is the ONE part of this stage that runs on
	 *   the extract job's error budget. An unavailable queue must not turn a successfully
	 *   extracted document into a `FAILED` one.
	 *
	 * `force` is derived from the run reason: bytes that changed (`replace`) or an explicit
	 * redo (`reindex`) regenerate; everything else honors the existing `thumbKey`.
	 */
	private async enqueueThumbnail(document: Document, job: IDocsStageJob<IDocsExtractJob>): Promise<void> {
		if (!isThumbnailableMime(document.mimeType)) {
			return;
		}
		try {
			const force = job.data.reason === 'replace' || job.data.reason === 'reindex';
			await this.enqueueChained<IDocsThumbnailJob>(
				DOCS_JOB_THUMBNAIL,
				{ ...this.baseOf(job.data), force },
				job
			);
		} catch (error) {
			this.logger.warn(
				`Could not enqueue docs.thumbnail for document ${document.id}: ${(error as Error).message} ` +
					'(cosmetic — extraction is unaffected)'
			);
		}
	}

	/**
	 * Carries the tenant/organization snapshot (and reason/initiator) forward to the
	 * next stage of the chain.
	 */
	private baseOf(payload: IDocsJobBase): IDocsJobBase {
		return {
			documentId: payload.documentId,
			tenantId: payload.tenantId,
			organizationId: payload.organizationId,
			reason: payload.reason,
			initiatedByUserId: payload.initiatedByUserId
		};
	}

	/**
	 * Loads the document from the job snapshot; a missing/soft-deleted row logs and
	 * completes the job (returns null — no retry).
	 */
	private async loadOrComplete(payload: IDocsJobBase, jobName: string): Promise<Document | null> {
		const document = await this.processingService.loadSnapshot(
			payload.documentId,
			payload.tenantId,
			payload.organizationId
		);
		if (!document) {
			this.logger.log(
				`${jobName}: document ${payload.documentId} not found for tenant ${payload.tenantId} — completing without retry`
			);
			return null;
		}
		return document;
	}

	/**
	 * Shared stage-error policy: transient errors rethrow (BullMQ retries with the
	 * 120 s-base exponential backoff); permanent errors dead-letter onto the document
	 * row and discard the job (no useless retries). The final transient attempt also
	 * dead-letters so the row never sticks in `PROCESSING`/`INDEXING`.
	 *
	 * Inline runs carry `attempts: 1`, so every attempt is the final one: the row is
	 * dead-lettered immediately instead of being retried (see `DOCS_INLINE_JOB_ATTEMPTS`).
	 */
	private async handleStageError(
		job: IDocsStageJob<IDocsJobBase>,
		document: Document,
		error: unknown,
		stage: 'extract' | 'knowledge'
	): Promise<void> {
		const transient = isTransientError(error);
		const attempts = job.attempts ?? 1;
		const isFinalAttempt = job.attemptsMade + 1 >= attempts;

		this.logger.error(
			`docs.${stage} failed for document ${document.id} (attempt ${job.attemptsMade + 1}/${attempts}, ` +
				`transient=${transient}): ${(error as Error).message}`
		);

		if (transient && !isFinalAttempt) {
			throw error; // BullMQ retries with backoff
		}

		// Dead-letter = the document row itself.
		if (stage === 'extract') {
			await this.processingService.markExtractionFailed(document, error);
		} else {
			await this.processingService.markKnowledgeFailed(document, error);
		}

		if (!transient) {
			await job.discard(); // skip remaining attempts — permanent errors never retry
		}
	}

	/**
	 * Last-resort dead-letter for an inline run: routes anything the stage's own error
	 * policy did not already catch through the standard failure path, so the row never
	 * sticks in `PROCESSING`/`INDEXING` and the operator sees a `statusMessage`.
	 *
	 * `extract`/`classify` failures belong to the extraction side (`status: FAILED`);
	 * `chunk`/`embed`/`index` failures are projection-only (`knowledgeStatus: FAILED`,
	 * the document itself stays fine). `reconcile` carries no document — it only logs.
	 */
	private async deadLetter(jobName: string, job: IDocsStageJob, error: unknown): Promise<void> {
		const payload = job.data as IDocsJobBase | undefined;
		this.logger.error(
			`${jobName} failed inline for document ${payload?.documentId ?? 'n/a'}: ${(error as Error)?.message ?? error}`
		);

		if (jobName === DOCS_JOB_RECONCILE || !payload?.documentId) {
			return;
		}

		// A thumbnail is cosmetic: it has no terminal state to record. Dead-lettering it as a
		// knowledge failure would put a red `knowledgeStatus` (and a `statusMessage`) on a
		// document whose text was extracted, chunked and indexed perfectly.
		if (jobName === DOCS_JOB_THUMBNAIL) {
			return;
		}

		try {
			const document = await this.loadOrComplete(payload, jobName);
			if (!document) {
				return;
			}
			if (jobName === DOCS_JOB_EXTRACT || jobName === DOCS_JOB_CLASSIFY) {
				await this.processingService.markExtractionFailed(document, error);
			} else {
				await this.processingService.markKnowledgeFailed(document, error);
			}
		} catch (markError) {
			// Nothing left to do but say so — never let the safety net itself reject.
			this.logger.error(
				`Failed to dead-letter ${jobName} for document ${payload.documentId}: ` +
					`${(markError as Error).message}`
			);
		}
	}
}
