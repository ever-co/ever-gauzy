import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { getDocsConfig } from '../../docs.config';
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
	IDocsReconcileJob
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
 */
@Injectable()
@QueueWorker(DOCS_PROCESSING_QUEUE, {
	concurrency: getDocsConfig().queueConcurrency
})
export class DocsProcessingWorker extends QueueWorkerHost {
	constructor(private readonly pipeline: DocsPipelineService) {
		super();
	}

	/** `docs.extract` → {@link DocsPipelineService.handleExtract}. */
	@QueueJobHandler(DOCS_JOB_EXTRACT)
	public async handleExtract(job: Job<IDocsExtractJob>): Promise<void> {
		await this.pipeline.handleExtract(fromBullJob(job));
	}

	/** `docs.classify` → {@link DocsPipelineService.handleClassify}. */
	@QueueJobHandler(DOCS_JOB_CLASSIFY)
	public async handleClassify(job: Job<IDocsClassifyJob>): Promise<void> {
		await this.pipeline.handleClassify(fromBullJob(job));
	}

	/** `docs.chunk` → {@link DocsPipelineService.handleChunk}. */
	@QueueJobHandler(DOCS_JOB_CHUNK)
	public async handleChunk(job: Job<IDocsChunkJob>): Promise<void> {
		await this.pipeline.handleChunk(fromBullJob(job));
	}

	/** `docs.embed` → {@link DocsPipelineService.handleEmbed}. */
	@QueueJobHandler(DOCS_JOB_EMBED)
	public async handleEmbed(job: Job<IDocsEmbedJob>): Promise<void> {
		await this.pipeline.handleEmbed(fromBullJob(job));
	}

	/** `docs.index` → {@link DocsPipelineService.handleIndex}. */
	@QueueJobHandler(DOCS_JOB_INDEX)
	public async handleIndex(job: Job<IDocsIndexJob>): Promise<void> {
		await this.pipeline.handleIndex(fromBullJob(job));
	}

	/** `docs.reconcile` → {@link DocsPipelineService.handleReconcile}. */
	@QueueJobHandler(DOCS_JOB_RECONCILE)
	public async handleReconcile(job: Job<IDocsReconcileJob>): Promise<void> {
		await this.pipeline.handleReconcile(fromBullJob(job));
	}
}
