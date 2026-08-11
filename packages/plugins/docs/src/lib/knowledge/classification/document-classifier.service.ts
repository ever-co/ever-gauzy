import { Injectable, Logger } from '@nestjs/common';
import {
	DocumentKindEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum
} from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { getDocsConfig } from '../../docs.config';
import { Document } from '../../entities/document.entity';
import { TypeOrmDocumentCategoryRepository } from '../../repositories/type-orm-document-category.repository';
import { TypeOrmDocumentRepository } from '../../repositories/type-orm-document.repository';
import { DocsAiService } from '../ai/docs-ai.service';
import { DOCS_CLASSIFY_MAX_OUTPUT_TOKENS, DOCS_LOW_CONFIDENCE_THRESHOLD } from '../knowledge.constants';
import { IDocsClassifyJob } from '../queue/docs-job.types';
import {
	buildClassificationPrompt,
	IClassificationOutput,
	parseClassificationOutput,
	sampleMarkdown
} from './classification.prompt';

/** What one classification run did — the worker logs it and always continues the chain. */
export type ClassificationOutcome = 'classified' | 'low-confidence' | 'skipped' | 'unusable' | 'failed';

/**
 * LLM document classification (§5 of the AI-knowledge spec).
 *
 * Runs as the `docs.classify` job for FILE documents after successful extraction.
 * Classification is **best-effort by spec**: any failure leaves the document `READY` with
 * `aiConfidence = null` — the worker chain continues regardless of the outcome.
 *
 * Skipped entirely for PAGE documents (author-controlled), for `source: SYSTEM` documents
 * (deterministic system captures need no LLM), and whenever AI is disabled or no provider
 * resolves (degradation ladder — a debug log, never an error).
 *
 * Worker-safe: every repository access uses the explicit tenant/organization snapshot of
 * the job payload; `RequestContext` is never consulted.
 */
@Injectable()
export class DocumentClassifierService {
	private readonly logger = new Logger(DocumentClassifierService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly typeOrmDocumentCategoryRepository: TypeOrmDocumentCategoryRepository,
		private readonly docsAiService: DocsAiService
	) {}

	/**
	 * Classifies one document (the `docs.classify` handler body).
	 *
	 * @param document The snapshot-loaded document row.
	 * @param job The classify-job payload (tenant/org snapshot).
	 * @returns The outcome — informational; the chain continues on every outcome.
	 */
	public async classify(document: Document, job: IDocsClassifyJob): Promise<ClassificationOutcome> {
		const config = getDocsConfig();

		if (!config.aiEnabled) {
			this.logger.debug(`docs.classify skipped for document ${document.id} — AI is disabled`);
			return 'skipped';
		}
		if (document.kind !== DocumentKindEnum.FILE) {
			this.logger.debug(`docs.classify skipped for document ${document.id} — not a FILE`);
			return 'skipped';
		}
		if (document.source === DocumentSourceEnum.SYSTEM) {
			this.logger.debug(`docs.classify skipped for document ${document.id} — SYSTEM source`);
			return 'skipped';
		}
		if (!document.extractedText) {
			this.logger.debug(`docs.classify skipped for document ${document.id} — no extracted text`);
			return 'skipped';
		}

		const resolved = await this.docsAiService.resolveChatModel(job.tenantId);
		const sdk = resolved ? await this.docsAiService.loadAiSdk() : null;
		if (!resolved || !sdk) {
			this.logger.debug(
				`docs.classify skipped for document ${document.id} — no AI provider resolves (lexical-only mode)`
			);
			return 'skipped';
		}

		// Tenant catalog → `slug: description` lines (system-seeded + user-added ride along).
		const catalog = await this.typeOrmDocumentCategoryRepository.find({
			where: { tenantId: job.tenantId, organizationId: job.organizationId }
		});
		const catalogLines = catalog
			.map((category) => `${category.slug}: ${category.description || category.name}`)
			.join('\n');

		const prompt = buildClassificationPrompt({
			catalogLines,
			originalFilename: document.originalFilename ?? document.name,
			sampledMarkdown: sampleMarkdown(document.extractedText, config.classifySampleChars)
		});

		const startedAt = Date.now();
		let rawOutput = '';
		let usage: { inputTokens: number; outputTokens: number; estimated: boolean } = {
			inputTokens: Math.ceil((prompt.system.length + prompt.user.length) / 4),
			outputTokens: 0,
			estimated: true
		};

		try {
			const result = await sdk.generateText({
				model: resolved.model,
				system: prompt.system,
				prompt: prompt.user,
				temperature: 0,
				maxOutputTokens: DOCS_CLASSIFY_MAX_OUTPUT_TOKENS
			});
			rawOutput = result.text ?? '';
			const reported = (result as any).usage;
			if (Number.isFinite(reported?.inputTokens) && Number.isFinite(reported?.outputTokens)) {
				usage = { inputTokens: reported.inputTokens, outputTokens: reported.outputTokens, estimated: false };
			} else {
				usage.outputTokens = Math.ceil(rawOutput.length / 4);
			}
			this.emitUsage(job, resolved.providerId, resolved.modelId, usage, startedAt, true);
		} catch (error) {
			this.emitUsage(job, resolved.providerId, resolved.modelId, usage, startedAt, false);
			// Best-effort by spec (§5.3): the document stays READY with null confidence.
			this.logger.warn(`docs.classify failed for document ${document.id}: ${(error as Error).message}`);
			return 'failed';
		}

		const output = parseClassificationOutput(
			rawOutput,
			catalog.map((category) => category.slug)
		);
		if (!output) {
			// Unusable output gates the document for human review (§5.3).
			await this.applyReviewGate(document);
			this.logger.warn(`docs.classify produced unusable output for document ${document.id}`);
			return 'unusable';
		}

		await this.applyClassification(document, output, catalog);

		if (output.confidence === null || output.confidence < DOCS_LOW_CONFIDENCE_THRESHOLD) {
			await this.applyReviewGate(document);
			return 'low-confidence';
		}
		return 'classified';
	}

	/**
	 * Persists the classification result: summary, confidence, `metadata.ai` block, and the
	 * AI-suggested categories applied **additively** via the pivot (user-set categories are
	 * never removed; tags are suggestions only — no `Tag` rows are auto-created).
	 */
	private async applyClassification(
		document: Document,
		output: IClassificationOutput,
		catalog: Array<{ id?: string; slug: string }>
	): Promise<void> {
		const existing = (document.metadata && typeof document.metadata === 'object' ? document.metadata : {}) as any;
		const metadata = {
			...existing,
			ai: {
				...(existing.ai ?? {}),
				suggestedTags: output.suggestedTags,
				language: output.language,
				classifiedAt: new Date().toISOString()
			}
		};

		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{
				summary: output.summary ?? document.summary ?? null,
				aiConfidence: output.confidence,
				// `.update()` bypasses entity subscribers — serialize for the sqlite text column.
				metadata: isSqlite() || isBetterSqlite3() ? (JSON.stringify(metadata) as any) : metadata
			} as any
		);
		document.summary = output.summary ?? document.summary;
		document.aiConfidence = output.confidence ?? undefined;
		document.metadata = metadata;

		// Additive category application through the pivot.
		if (output.categories.length) {
			const bySlug = new Map(
				catalog
					.filter((category): category is { id: string; slug: string } => Boolean(category.id))
					.map((category) => [category.slug.toLowerCase(), category.id])
			);
			const targetIds = output.categories
				.map((slug) => bySlug.get(slug.toLowerCase()))
				.filter((id): id is string => Boolean(id));
			if (targetIds.length) {
				const withCategories = await this.typeOrmDocumentRepository.findOne({
					where: { id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
					relations: { categories: true }
				});
				const current = new Set((withCategories?.categories ?? []).map((category) => category.id));
				const additions = targetIds.filter((id) => !current.has(id));
				if (additions.length) {
					await this.typeOrmDocumentRepository
						.createQueryBuilder()
						.relation(Document, 'categories')
						.of(document.id)
						.add(additions);
				}
			}
		}
	}

	/**
	 * Flips the document to `reviewStatus: PENDING / low-confidence` — the review circuit
	 * breaker excludes it from retrieval until a human approves (§12).
	 */
	private async applyReviewGate(document: Document): Promise<void> {
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
			{
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.LOW_CONFIDENCE
			}
		);
		document.reviewStatus = DocumentReviewStatusEnum.PENDING;
		document.reviewReason = DocumentReviewReasonEnum.LOW_CONFIDENCE;
	}

	/**
	 * Cost-accounting emission for one classification call (§7.4).
	 */
	private emitUsage(
		job: IDocsClassifyJob,
		providerId: string,
		model: string,
		usage: { inputTokens: number; outputTokens: number; estimated: boolean },
		startedAt: number,
		success: boolean
	): void {
		this.docsAiService.emitUsage({
			tenantId: job.tenantId,
			organizationId: job.organizationId,
			feature: 'docs-classify',
			providerId,
			model,
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			estimated: usage.estimated,
			durationMs: Date.now() - startedAt,
			success
		});
	}
}
