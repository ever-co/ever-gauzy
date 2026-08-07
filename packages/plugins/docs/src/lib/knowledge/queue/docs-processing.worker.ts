import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { getDocsConfig } from '../../docs.config';
import { Document } from '../../entities/document.entity';
import { DocumentProcessingService } from '../../services/document-processing.service';
import { DocumentClassifierService } from '../classification/document-classifier.service';
import { DocumentIndexService } from '../indexing/document-index.service';
import { isTransientError } from '../errors';
import {
	DOCS_JOB_CHUNK,
	DOCS_JOB_CLASSIFY,
	DOCS_JOB_EMBED,
	DOCS_JOB_EXTRACT,
	DOCS_JOB_INDEX,
	DOCS_JOB_RECONCILE,
	DOCS_PROCESSING_QUEUE
} from './constants';
import {
	IDocsChunkJob,
	IDocsClassifyJob,
	IDocsEmbedJob,
	IDocsExtractJob,
	IDocsIndexJob,
	IDocsJobBase,
	IDocsReconcileJob
} from './docs-job.types';
import { DocsRecoveryService } from './docs-recovery.service';
import { DocsQueueService } from './docs-queue.service';

/**
 * The `docs-processing` BullMQ worker host — the full M3 pipeline:
 * `extract → classify → chunk → embed → index`.
 *
 * Handlers chain the graph explicitly: each enqueues the next stage on success, with a
 * per-run idempotency suffix derived from the current job id (BullMQ retries of a stage
 * reuse the same chained ids; duplicate STARTS coalesce on the deterministic entry ids).
 *
 * AI-disabled / no-provider deployments run the lexical-only path per the degradation
 * ladder: classify no-ops, embed skips, and index records the lexical-only marker — the
 * document still reaches `INDEXED`. Nothing is ever stuck waiting on AI availability.
 *
 * Every handler re-loads the document from the explicit tenant/organization snapshot on
 * the payload; a soft-deleted or missing row logs and completes (no retry).
 * `RequestContext` is NEVER consulted here — queue threads have none.
 */
@Injectable()
@QueueWorker(DOCS_PROCESSING_QUEUE, {
	concurrency: getDocsConfig().queueConcurrency
})
export class DocsProcessingWorker extends QueueWorkerHost {
	private readonly logger = new Logger(DocsProcessingWorker.name);

	constructor(
		private readonly processingService: DocumentProcessingService,
		private readonly docsQueueService: DocsQueueService,
		private readonly recoveryService: DocsRecoveryService,
		private readonly classifierService: DocumentClassifierService,
		private readonly documentIndexService: DocumentIndexService
	) {
		super();
	}

	/**
	 * `docs.extract` — load blob, run the extraction registry, write `extractedText`,
	 * set `READY`, then chain classification.
	 */
	@QueueJobHandler(DOCS_JOB_EXTRACT)
	public async handleExtract(job: Job<IDocsExtractJob>): Promise<void> {
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

		// `keepExtractedText` runs skip classification entirely (human-correction guard) —
		// they enter the knowledge chain directly.
		if (job.data.keepExtractedText) {
			if (document.knowledgeStatus === DocumentKnowledgeStatusEnum.QUEUED) {
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
	@QueueJobHandler(DOCS_JOB_CLASSIFY)
	public async handleClassify(job: Job<IDocsClassifyJob>): Promise<void> {
		const document = await this.loadOrComplete(job.data, DOCS_JOB_CLASSIFY);
		if (!document) {
			return;
		}

		const outcome = await this.classifierService.classify(document, job.data);
		this.logger.log(`docs.classify outcome for document ${document.id}: ${outcome}`);

		if (document.knowledgeStatus === DocumentKnowledgeStatusEnum.QUEUED) {
			await this.enqueueChained(DOCS_JOB_CHUNK, this.baseOf(job.data), job);
		}
	}

	/**
	 * `docs.chunk` — heading-aware ~512/64-token windows with locator metadata,
	 * transactional chunk replace, and the `contentHash` skip-if-unchanged short-circuit.
	 */
	@QueueJobHandler(DOCS_JOB_CHUNK)
	public async handleChunk(job: Job<IDocsChunkJob>): Promise<void> {
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
	@QueueJobHandler(DOCS_JOB_EMBED)
	public async handleEmbed(job: Job<IDocsEmbedJob>): Promise<void> {
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
	@QueueJobHandler(DOCS_JOB_INDEX)
	public async handleIndex(job: Job<IDocsIndexJob>): Promise<void> {
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
	 * `docs.reconcile` — the every-10-minutes recovery + model-drift sweep (also enqueued
	 * at startup).
	 */
	@QueueJobHandler(DOCS_JOB_RECONCILE)
	public async handleReconcile(job: Job<IDocsReconcileJob>): Promise<void> {
		this.logger.log(`Reconcile sweep requested at ${job.data?.requestedAt ?? 'unknown'}`);
		await this.recoveryService.runScan('reconcile');
	}

	/**
	 * A document excluded/reset while its knowledge chain was in flight aborts the chain
	 * silently (skipping is not an error).
	 */
	private knowledgeChainAborted(document: Document, jobName: string): boolean {
		if (
			document.knowledgeStatus === DocumentKnowledgeStatusEnum.NONE ||
			document.knowledgeStatus === DocumentKnowledgeStatusEnum.EXCLUDED
		) {
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
	 * completed job.
	 */
	private async enqueueChained<T extends IDocsJobBase>(jobName: string, payload: T, currentJob: Job): Promise<void> {
		const seed = `${currentJob.id ?? 'no-id'}:${jobName}`;
		const suffix = createHash('sha256').update(seed).digest('hex').slice(0, 16);
		await this.docsQueueService.enqueue(jobName, payload, {
			jobId: `${this.docsQueueService.jobIdFor(jobName, payload.documentId)}:${suffix}`
		});
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
	 */
	private async handleStageError(
		job: Job<IDocsJobBase>,
		document: Document,
		error: unknown,
		stage: 'extract' | 'knowledge'
	): Promise<void> {
		const transient = isTransientError(error);
		const attempts = job.opts?.attempts ?? 1;
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
}
