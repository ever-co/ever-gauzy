import { Injectable, Logger } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum
} from '@gauzy/contracts';
import { ScheduledJob } from '@gauzy/scheduler';
import { getDocsConfig } from '../../docs.config';
import {
	DOCS_RECOVERY_FAILED_AFTER_HOURS,
	DOCS_RECOVERY_STARTUP_DELAY_MS,
	DOCS_RECOVERY_UPLOADED_STALE_MINUTES
} from '../../docs.constants';
import { Document } from '../../entities/document.entity';
import { TypeOrmDocumentIndexStateRepository } from '../../repositories/type-orm-document-index-state.repository';
import { TypeOrmDocumentRepository } from '../../repositories/type-orm-document.repository';
import { DocsAiService } from '../ai/docs-ai.service';
import { LEXICAL_ONLY_EMBEDDING_MODEL, VECTOR_STORE_LEXICAL } from '../knowledge.constants';
import { DocumentVectorStoreRegistry } from '../vector-store/vector-store.registry';
import { DOCS_JOB_CHUNK, DOCS_JOB_EXTRACT, DOCS_JOB_RECONCILE, DOCS_PROCESSING_QUEUE } from './constants';
import { IDocsReconcileJob } from './docs-job.types';
import { classifyRecoveryAction, IRecoveryThresholds } from './docs-recovery.predicate';
import { DocsQueueService } from './docs-queue.service';

/** Upper bound of auto-reindex enqueues per drift sweep — the next run picks up the rest. */
const DRIFT_SWEEP_MAX_ENQUEUES = 200;

/**
 * Startup recovery + periodic reconcile for the `docs-processing` pipeline.
 *
 * The DB row is the source of truth; the queue is not. BullMQ persists jobs in Redis so
 * most restarts resume without the scan — the scan covers Redis data loss and rows saved
 * `PROCESSING` before a crash mid-handler. Re-enqueues carry `reason: 'recovery'` and a
 * **run-unique** job id (`docs:<stage>:<documentId>:<runId>`): the plain deterministic id
 * is silently DISCARDED by BullMQ while a job with that id still sits in the retained
 * completed set, which is exactly the state a stuck document is in — the safety net would
 * report success and do nothing. One `runId` per sweep still coalesces duplicates inside a
 * single scan, the same way the other deliberate re-run sites work (`reprocess`,
 * `reindexDocument`, `regenerateSummary`, the drift sweep below).
 */
@Injectable()
export class DocsRecoveryService {
	private readonly logger = new Logger(DocsRecoveryService.name);
	private startupTimer?: ReturnType<typeof setTimeout>;

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly typeOrmDocumentIndexStateRepository: TypeOrmDocumentIndexStateRepository,
		private readonly docsQueueService: DocsQueueService,
		private readonly docsAiService: DocsAiService
	) {}

	/**
	 * Schedules the startup recovery scan — delayed (15 s settle), non-blocking. Called
	 * from `DocsPlugin.onPluginBootstrap()`.
	 */
	public scheduleStartupScan(): void {
		this.startupTimer = setTimeout(() => {
			this.runScan('startup').catch((error: Error) => {
				this.logger.error(`Startup recovery scan failed: ${error.message}`);
			});
		}, DOCS_RECOVERY_STARTUP_DELAY_MS);
		// Never keep the process alive for a recovery scan.
		if (typeof this.startupTimer?.unref === 'function') {
			this.startupTimer.unref();
		}
	}

	/**
	 * Cancels the pending startup scan (plugin destroy).
	 */
	public cancelStartupScan(): void {
		if (this.startupTimer) {
			clearTimeout(this.startupTimer);
			this.startupTimer = undefined;
		}
	}

	/**
	 * Every-10-minutes reconcile: enqueues the `docs.reconcile` job (deterministic job
	 * id via the scheduler, so overlapping schedulers coalesce). The worker handler runs
	 * `runScan('reconcile')`.
	 */
	@ScheduledJob({
		name: 'docs-reconcile-schedule',
		cron: '*/10 * * * *', // every 10 minutes
		queueName: DOCS_PROCESSING_QUEUE,
		queueJobName: DOCS_JOB_RECONCILE,
		preventOverlap: true
	})
	public async enqueueReconcile(): Promise<IDocsReconcileJob> {
		const requestedAt = new Date().toISOString();
		this.logger.log(`Queue docs.reconcile sweep at ${requestedAt}`);
		return { requestedAt };
	}

	/**
	 * Runs one recovery scan: re-enqueues stale `UPLOADED`/`PROCESSING` rows from
	 * `docs.extract`, stale knowledge `QUEUED`/`INDEXING` rows from `docs.chunk`, and
	 * flips rows stuck in `PROCESSING` beyond the fail-after window to `FAILED`.
	 *
	 * Read-only except for the enqueues and the fail-flip; plain repository queries with
	 * explicit predicates (no request context on this path).
	 *
	 * @param mode Log label: `startup` or `reconcile`.
	 * @returns Per-action counters (also used by tests).
	 */
	public async runScan(mode: 'startup' | 'reconcile'): Promise<Record<string, number>> {
		const config = getDocsConfig();
		const thresholds: IRecoveryThresholds = {
			uploadedStaleMinutes: DOCS_RECOVERY_UPLOADED_STALE_MINUTES,
			stuckThresholdMinutes: config.stuckThresholdMinutes,
			failAfterHours: DOCS_RECOVERY_FAILED_AFTER_HOURS
		};
		const now = new Date();
		const staleBefore = new Date(now.getTime() - thresholds.uploadedStaleMinutes * 60_000);
		// One id suffix per sweep: duplicates INSIDE a scan still coalesce, while every new
		// scan gets ids BullMQ has never retained — see the class doc.
		const runId = now.getTime();

		// One bounded query: every row that could possibly need recovery.
		const candidates = await this.typeOrmDocumentRepository.find({
			where: [
				{
					kind: DocumentKindEnum.FILE,
					status: In([DocumentStatusEnum.UPLOADED, DocumentStatusEnum.PROCESSING]),
					updatedAt: LessThan(staleBefore)
				},
				{
					status: DocumentStatusEnum.READY,
					knowledgeStatus: In([DocumentKnowledgeStatusEnum.QUEUED, DocumentKnowledgeStatusEnum.INDEXING]),
					updatedAt: LessThan(staleBefore)
				}
			],
			take: 500 // bounded sweep — the next run picks up the rest
		});

		const counters = { 'reenqueue-extract': 0, 'reenqueue-chunk': 0, 'mark-failed': 0, skipped: 0 };

		for (const document of candidates) {
			const action = classifyRecoveryAction(document, now, thresholds);
			switch (action) {
				case 'reenqueue-extract': {
					await this.docsQueueService.enqueue(DOCS_JOB_EXTRACT, this.recoverySnapshot(document), {
						jobId: this.recoveryJobId(DOCS_JOB_EXTRACT, document.id, runId)
					});
					counters['reenqueue-extract']++;
					break;
				}
				case 'reenqueue-chunk': {
					await this.docsQueueService.enqueue(DOCS_JOB_CHUNK, this.recoverySnapshot(document), {
						jobId: this.recoveryJobId(DOCS_JOB_CHUNK, document.id, runId)
					});
					counters['reenqueue-chunk']++;
					break;
				}
				case 'mark-failed': {
					await this.typeOrmDocumentRepository.update(
						{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
						{
							status: DocumentStatusEnum.FAILED,
							statusMessage: 'Processing was interrupted and could not be recovered.',
							reviewStatus: DocumentReviewStatusEnum.PENDING,
							reviewReason: DocumentReviewReasonEnum.EXTRACTION_FAILED
						}
					);
					counters['mark-failed']++;
					break;
				}
				default:
					counters.skipped++;
			}
		}

		this.logger.log(
			`Recovery scan (${mode}): candidates=${candidates.length}, extract=${counters['reenqueue-extract']}, ` +
				`chunk=${counters['reenqueue-chunk']}, failed=${counters['mark-failed']}`
		);

		// §8.4 — embedding-model drift detection rides the same sweep.
		try {
			counters['model-drift'] = await this.runModelDriftSweep();
		} catch (error) {
			this.logger.warn(`Model-drift sweep failed: ${(error as Error).message}`);
		}

		return counters;
	}

	/**
	 * Embedding-model drift detection (§8.4): compares the deployment's expected embedding
	 * model against `SELECT DISTINCT embeddingModel FROM document_index_state` and logs a
	 * summary when they diverge. Auto re-index is OFF by default
	 * (`GAUZY_DOCS_AUTO_REINDEX_ON_MODEL_CHANGE`) — a model flip on a large installation
	 * is deliberate, budgeted work. When enabled, mismatched rows are re-enqueued from
	 * `docs.chunk` at low priority (bounded per sweep; `reason: 'model-changed'`).
	 *
	 * @returns The number of drifted documents (enqueued or merely reported).
	 */
	public async runModelDriftSweep(): Promise<number> {
		const config = getDocsConfig();

		// The deployment-wide expected model: the configured model when embeddings could
		// actually be produced right now (AI on + provider + vector-capable store), else
		// the lexical sentinel. (Tenant-BYOK divergence is handled per document by the
		// bulk-reindex endpoint, which resolves per tenant.)
		const store = await DocumentVectorStoreRegistry.resolve();
		const vectorCapable = Boolean(store && store.id !== VECTOR_STORE_LEXICAL);
		const expectedModel =
			config.aiEnabled && vectorCapable && this.docsAiService.embeddingProviderConfigured()
				? config.embeddingModel
				: LEXICAL_ONLY_EMBEDDING_MODEL;

		const distinct: Array<{ embeddingModel: string; count: string }> = await this.typeOrmDocumentIndexStateRepository
			.createQueryBuilder('state')
			.select('state.embeddingModel', 'embeddingModel')
			.addSelect('COUNT(*)', 'count')
			.groupBy('state.embeddingModel')
			.getRawMany();

		const drifted = distinct.filter((row) => row.embeddingModel !== expectedModel);
		if (!drifted.length) {
			return 0;
		}

		const driftedTotal = drifted.reduce((sum, row) => sum + Number(row.count), 0);
		this.logger.warn(
			`Embedding-model drift: expected '${expectedModel}', found ` +
				drifted.map((row) => `'${row.embeddingModel}' (${row.count})`).join(', ') +
				` — ${config.autoReindexOnModelChange ? 'auto re-index is ON' : 'run POST /knowledge/reindex to re-embed'}`
		);

		if (!config.autoReindexOnModelChange) {
			return driftedTotal;
		}

		// Bounded, low-priority re-enqueue of mismatched rows across tenants.
		const rows = await this.typeOrmDocumentIndexStateRepository
			.createQueryBuilder('state')
			.select(['state.documentId AS "documentId"', 'state.tenantId AS "tenantId"', 'state.organizationId AS "organizationId"'])
			.where('state.embeddingModel != :expectedModel', { expectedModel })
			.limit(DRIFT_SWEEP_MAX_ENQUEUES)
			.getRawMany();

		const runId = Date.now();
		for (const row of rows) {
			await this.docsQueueService.enqueue(
				DOCS_JOB_CHUNK,
				{
					documentId: row.documentId,
					tenantId: row.tenantId,
					organizationId: row.organizationId,
					reason: 'model-changed' as const
				},
				{ jobId: this.recoveryJobId(DOCS_JOB_CHUNK, row.documentId, runId), priority: 10 }
			);
		}
		this.logger.log(`Model-drift auto re-index enqueued ${rows.length}/${driftedTotal} documents`);
		return driftedTotal;
	}

	/**
	 * Builds the run-unique BullMQ job id of a recovery re-enqueue.
	 *
	 * The plain `docs:<stage>:<documentId>` id is not usable here: a stuck document usually
	 * still HAS that id retained in the completed set, and BullMQ drops an `add()` for an
	 * existing id without an error — the enqueue would report success while nothing runs.
	 *
	 * @param jobName The `DOCS_JOB_*` stage constant.
	 * @param documentId The document being recovered.
	 * @param runId The per-sweep stamp shared by every enqueue of one scan.
	 */
	private recoveryJobId(jobName: string, documentId: string, runId: number): string {
		return `${this.docsQueueService.jobIdFor(jobName, documentId)}:${runId}`;
	}

	/**
	 * Builds the recovery job snapshot for one row (system-initiated — no user id).
	 */
	private recoverySnapshot(document: Document) {
		return {
			documentId: document.id,
			tenantId: document.tenantId,
			organizationId: document.organizationId,
			reason: 'recovery' as const
		};
	}
}
