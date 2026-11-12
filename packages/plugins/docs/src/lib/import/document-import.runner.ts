import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
	DocumentImportItemStatusEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentVisibilityEnum,
	ID,
	IDocumentImportReport,
	IDocumentImportReportItem
} from '@gauzy/contracts';
import {
	DOCS_IMPORT_EXTERNAL_SOURCE_PREFIX,
	DOCS_IMPORT_MAX_PAGE_BYTES,
	DOCS_IMPORT_NO_PAGES,
	DOCS_IMPORT_PROGRESS_EVERY,
	DOCS_IMPORT_REPORT_MAX_ITEMS,
	DOCS_IMPORT_STALE_MINUTES
} from '../docs.constants';
import { sniffFile } from '../services/file-sniffer';
import {
	DOCS_IMPORT_STORE,
	IDocumentImportStore,
	IImportedDocumentRef,
	IImportOptions,
	IImportRow,
	IImportScope
} from './document-import.types';
import { IImportArchiveEntry, IImportArchiveLimits, ImportArchiveError, openImportArchive, verifyImportArchive } from './import-archive';
import { convertImportedPage, IImportPageMeta, IImportPageSource, readImportPage } from './import-content';
import { buildImportPlan, detectImportLayout, externalIdOf, IImportPlan, IImportPlanNode, ImportLinkIndex } from './import-plan';

/** Why an item was skipped or failed (`IDocumentImportReportItem.reason`). */
export const DOCS_IMPORT_REASONS = {
	ENCRYPTED: 'ENCRYPTED',
	TOO_LARGE: 'TOO_LARGE',
	UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
	QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
	PARENT_MISSING: 'PARENT_MISSING',
	READ_FAILED: 'READ_FAILED',
	CREATE_FAILED: 'CREATE_FAILED',
	CONVERSION_FAILED: 'CONVERSION_FAILED',
	/** The page was imported, but as plain paragraphs: its converted body did not pass the page schema. */
	PLAIN_TEXT: 'PLAIN_TEXT'
} as const;

/** The code of an import that failed for a reason other than its archive. */
export const DOCS_IMPORT_FAILED = 'DOCS_IMPORT_FAILED';

/** What one run ended with. */
export interface IImportRunOutcome {
	status: DocumentImportStatusEnum;
	importedCount: number;
	skippedCount: number;
	failedCount: number;
}

/**
 * The options of a row. What is missing (a row written before a field existed) takes the default the request thread
 * would have written: the quota `0` (the platform's "unlimited"), no knowledge import, the default per-file limit, the
 * installation's archive limits.
 */
export function parseImportOptions(raw: string | null | undefined, fallbackLimits: IImportArchiveLimits): IImportOptions {
	let parsed: Partial<IImportOptions>;
	try {
		parsed = raw ? JSON.parse(raw) : {};
	} catch {
		parsed = {};
	}
	return {
		quotaBytes: Number.isFinite(Number(parsed.quotaBytes)) && Number(parsed.quotaBytes) >= 0 ? Number(parsed.quotaBytes) : 0,
		importToKnowledge: parsed.importToKnowledge === true,
		maxFileSize: Number(parsed.maxFileSize) > 0 ? Number(parsed.maxFileSize) : 50 * 1024 * 1024,
		limits: { ...fallbackLimits, ...(parsed.limits ?? {}) },
		initiatedByUserId: parsed.initiatedByUserId ?? null
	};
}

/** The report of a run, item by item (at most `max` kept), with exact counts past the cap. */
class ImportReport {
	private readonly items = new Map<string, IDocumentImportReportItem>();
	/** Every item's latest status, kept items or not: the counts are made from this. */
	private readonly statusOf = new Map<string, DocumentImportItemStatusEnum>();
	private truncated = false;

	constructor(private readonly max: number) {}

	set(key: string, item: IDocumentImportReportItem): void {
		this.statusOf.set(key, item.status);
		if (!this.items.has(key) && this.items.size >= this.max) {
			this.truncated = true;
			return;
		}
		this.items.set(key, item);
	}

	get(key: string): IDocumentImportReportItem | undefined {
		return this.items.get(key);
	}

	count(status: DocumentImportItemStatusEnum): number {
		let total = 0;
		for (const value of this.statusOf.values()) if (value === status) total += 1;
		return total;
	}

	toJSON(): IDocumentImportReport {
		return { items: [...this.items.values()], ...(this.truncated ? { truncated: true } : {}) };
	}
}

/**
 * One run of an import (`docs-import-export` plan §5) — the `docs.import` stage of the `docs-processing` pipeline, on
 * a BullMQ worker or inline. It owns no state but the row: every decision of the request thread is on the row, every
 * document it creates carries the provenance `docs-import:<importId>` + a digest of its archive path, so a run that
 * stops anywhere is re-run from the top and finds what it already made instead of making it twice.
 *
 * 1. **Planning**: the zip is read from storage and inspected again (the request checked it; a stored object is not
 *    trusted twice by accident), the layout detected and the tree planned.
 * 2. **Tree**: folders and pages, parents first (each page file is read for its title, icon and created date, and for
 *    the attachments it shows); then the attachments, through the upload checks (type sniffing, the per-file limit,
 *    the quota), under the page that first shows them.
 * 3. **Content**: every page converted with every link resolved against what the run created, and written.
 *
 * Transient failures are rethrown while the queue has attempts left (the row stays RUNNING; the retry resumes it); an
 * archive the inspection refuses, or the last attempt, ends the import FAILED with a code and a message.
 */
@Injectable()
export class DocumentImportRunner {
	private readonly logger = new Logger(DocumentImportRunner.name);
	/** The items a report keeps (the counts are always complete). */
	public reportMaxItems = DOCS_IMPORT_REPORT_MAX_ITEMS;

	constructor(@Inject(DOCS_IMPORT_STORE) private readonly store: IDocumentImportStore) {}

	/**
	 * Runs (or resumes) an import.
	 *
	 * @param importId The `document_import` row.
	 * @param scope The tenant / organization snapshot of the job.
	 * @param fallbackLimits The installation's archive limits, for a row that predates its stored ones.
	 * @param finalAttempt Whether the queue has no attempt left after this one (inline runs always are).
	 */
	async run(importId: ID, scope: IImportScope, fallbackLimits: IImportArchiveLimits, finalAttempt = true): Promise<IImportRunOutcome | null> {
		const row = await this.store.load(importId, scope);
		if (!row) {
			this.logger.warn(`docs.import: import ${importId} not found for tenant ${scope.tenantId} — nothing to run`);
			return null;
		}
		if (row.status === DocumentImportStatusEnum.COMPLETED || row.status === DocumentImportStatusEnum.FAILED) {
			return { status: row.status, importedCount: row.importedCount ?? 0, skippedCount: row.skippedCount ?? 0, failedCount: row.failedCount ?? 0 };
		}
		const options = parseImportOptions(row.optionsJson, fallbackLimits);
		// One run at a time: the row is claimed by a conditional update (QUEUED, or RUNNING without progress for the stale
		// window), so two jobs for one import — a resume racing a retry, two sweeps — cannot both run it.
		// The run's fence: the attempt number its claim writes. Every later write of the run states it, so a run that a
		// later claim took over (it stalled past the stale window) changes neither the row nor the archive.
		const fence = (row.attempts ?? 0) + 1;
		const claimed = await this.store.claim(row.id, scope, new Date(Date.now() - DOCS_IMPORT_STALE_MINUTES * 60_000), {
			status: DocumentImportStatusEnum.RUNNING,
			phase: DocumentImportPhaseEnum.PLANNING,
			attempts: fence,
			startedAt: row.startedAt ?? new Date(),
			lastProgressAt: new Date(),
			errorCode: null,
			errorMessage: null
		});
		if (!claimed) {
			this.logger.log(`docs.import ${row.id}: another run holds the import — this one stops`);
			return null;
		}

		try {
			const outcome = await this.execute(row, scope, options, finalAttempt, fence);
			this.logger.log(
				`docs.import ${row.id} completed (tenant ${scope.tenantId}): imported ${outcome.importedCount}, ` +
					`skipped ${outcome.skippedCount}, failed ${outcome.failedCount}`
			);
			await this.discard(row, fence);
			return outcome;
		} catch (error) {
			if (error instanceof ImportRunDisplacedError) {
				this.logger.warn(`docs.import ${row.id}: another run took the import over — this one stops`);
				return null;
			}
			const archiveError = error instanceof ImportArchiveError ? error : null;
			if (!archiveError && !finalAttempt) {
				this.logger.warn(`docs.import ${row.id} failed, the queue retries it: ${(error as Error)?.message ?? error}`);
				// Back to QUEUED, so the retry can claim it (only while the import is still this run's).
				await this.store.update(row.id, scope, { status: DocumentImportStatusEnum.QUEUED, lastProgressAt: new Date() }, fence).catch(() => false);
				throw error;
			}
			const code = archiveError?.code ?? DOCS_IMPORT_FAILED;
			const message = String(archiveError?.message ?? (error as Error)?.message ?? error).slice(0, 500);
			this.logger.error(`docs.import ${row.id} failed (tenant ${scope.tenantId}): ${code} ${message}`);
			const failed = await this.store.update(
				row.id,
				scope,
				{
					status: DocumentImportStatusEnum.FAILED,
					errorCode: code,
					errorMessage: message,
					finishedAt: new Date(),
					lastProgressAt: new Date()
				},
				fence
			);
			if (!failed) {
				this.logger.warn(`docs.import ${row.id}: another run took the import over — its failure is not recorded`);
				return null;
			}
			await this.discard(row, fence);
			return { status: DocumentImportStatusEnum.FAILED, importedCount: 0, skippedCount: 0, failedCount: 0 };
		}
	}

	/** The three phases; throws what ends or retries the run. */
	private async execute(
		row: IImportRow,
		scope: IImportScope,
		options: IImportOptions,
		finalAttempt: boolean,
		fence: number
	): Promise<IImportRunOutcome> {
		/** A write of this run: one the import no longer accepts (taken over) stops the run. */
		const update = async (patch: Partial<IImportRow>) => {
			if (!(await this.store.update(row.id, scope, patch, fence))) throw new ImportRunDisplacedError(row.id);
		};
		const buffer = await this.store.readArchive(row);
		const archive = await openImportArchive(buffer, options.limits);
		const paths = archive.entries.map((entry) => entry.path);
		const layout = detectImportLayout(paths, archive.directories);
		if (!layout) {
			throw new ImportArchiveError(DOCS_IMPORT_NO_PAGES, 'The archive holds no page file: it is not an exported workspace.');
		}
		// Every entry inflated once before anything is created: an entry that lies about its size refuses the archive here,
		// instead of being met halfway through the tree.
		await verifyImportArchive(archive);
		const plan = buildImportPlan(paths, archive.directories, layout);
		const entries = new Map(archive.entries.map((entry) => [entry.path, entry]));
		const run = new ImportRun(row, scope, options, plan, entries, this.store, finalAttempt, this.reportMaxItems, fence);
		// Every node once for the tree, every page once more for its content.
		const totalItems = plan.nodes.length + plan.nodes.filter((node) => node.kind === DocumentKindEnum.PAGE).length;
		await update({ layout, totalItems, processedItems: 0, phase: DocumentImportPhaseEnum.TREE, lastProgressAt: new Date() });
		await run.tree();
		await update({
			phase: DocumentImportPhaseEnum.CONTENT,
			processedItems: run.processedItems,
			lastProgressAt: new Date(),
			...run.counts(),
			reportJson: run.reportJson()
		});
		await run.content();
		const counts = run.counts();
		await update({
			status: DocumentImportStatusEnum.COMPLETED,
			phase: DocumentImportPhaseEnum.DONE,
			processedItems: totalItems,
			...counts,
			reportJson: run.reportJson(),
			finishedAt: new Date(),
			lastProgressAt: new Date()
		});
		return { status: DocumentImportStatusEnum.COMPLETED, ...counts };
	}

	private async discard(row: IImportRow, fence: number): Promise<void> {
		try {
			await this.store.discardArchive(row, fence);
		} catch (error) {
			this.logger.warn(`docs.import ${row.id}: the uploaded zip could not be deleted: ${(error as Error)?.message ?? error}`);
		}
	}
}

/** A run whose import a later claim took over (it stalled past the stale window): it stops, writing nothing more. */
export class ImportRunDisplacedError extends Error {
	constructor(importId: ID) {
		super(`Import ${importId} was taken over by another run`);
		this.name = 'ImportRunDisplacedError';
	}
}

/** The state of one run: what was created, the pages' metadata, the report, the progress. */
class ImportRun {
	private readonly logger = new Logger('DocumentImportRun');
	private readonly created = new Map<string, IImportedDocumentRef>();
	private readonly metaOf = new Map<string, IImportPageMeta>();
	/** The page that first shows each attachment (by node key). */
	private readonly firstPageOf = new Map<string, string>();
	/** The pages created and readable, whose content the content phase writes (the report may stop keeping items). */
	private readonly pagesToWrite = new Set<string>();
	private readonly report: ImportReport;
	private readonly links: ImportLinkIndex;
	private readonly externalSource: string;
	private readonly visibility: DocumentVisibilityEnum;
	private readonly organizationTeamId: ID | null;
	private readonly owner: ID | null;
	private processed = 0;

	constructor(
		private readonly row: IImportRow,
		private readonly scope: IImportScope,
		private readonly options: IImportOptions,
		private readonly plan: IImportPlan,
		private readonly entries: Map<string, IImportArchiveEntry>,
		private readonly store: IDocumentImportStore,
		/**
		 * Whether the queue has no attempt left. Before the last attempt, a failure to create or write an item ends the
		 * run so the queue retries it (a resumed run finds what this one made); on the last one the item is reported
		 * FAILED and the import goes on, so one bad entry cannot sink the rest.
		 */
		private readonly finalAttempt: boolean,
		reportMaxItems: number,
		/** The run's fence (the attempt its claim wrote): its progress writes state it. */
		private readonly fence: number
	) {
		this.report = new ImportReport(reportMaxItems);
		this.links = new ImportLinkIndex(plan);
		this.externalSource = `${DOCS_IMPORT_EXTERNAL_SOURCE_PREFIX}${row.id}`;
		this.visibility = row.visibility ?? DocumentVisibilityEnum.ORGANIZATION;
		this.organizationTeamId = this.visibility === DocumentVisibilityEnum.TEAM ? row.organizationTeamId ?? null : null;
		this.owner = options.initiatedByUserId ?? row.createdByUserId ?? null;
	}

	counts(): { importedCount: number; skippedCount: number; failedCount: number } {
		return {
			importedCount: this.report.count(DocumentImportItemStatusEnum.IMPORTED),
			skippedCount: this.report.count(DocumentImportItemStatusEnum.SKIPPED),
			failedCount: this.report.count(DocumentImportItemStatusEnum.FAILED)
		};
	}

	/** The steps done so far (tree nodes, then pages written). */
	get processedItems(): number {
		return this.processed;
	}

	reportJson(): string {
		return JSON.stringify(this.report.toJSON());
	}

	/** Folders and pages, parents first; then the attachments. */
	async tree(): Promise<void> {
		for (const node of this.plan.nodes) {
			if (node.kind !== DocumentKindEnum.FILE) await this.containerOrPage(node);
		}
		for (const node of this.plan.nodes) {
			if (node.kind !== DocumentKindEnum.FILE) continue;
			// The usage is read again before each attachment, as an upload reads it: what another import (or upload) of
			// the organization stored meanwhile counts, not only what this run stored.
			const usedBytes = this.options.quotaBytes > 0 ? await this.store.usedBytes(this.scope) : 0;
			await this.attachment(node, usedBytes);
		}
	}

	/** Every page's body, converted and written. */
	async content(): Promise<void> {
		for (const node of this.plan.nodes) {
			if (node.kind !== DocumentKindEnum.PAGE) continue;
			const document = this.created.get(node.key);
			if (!document || !this.pagesToWrite.has(node.key)) continue;
			const item = this.report.get(node.key) ?? this.item(node, DocumentImportItemStatusEnum.IMPORTED, { documentId: document.id, name: document.name });
			try {
				const source = await this.readPage(node);
				if (!source) continue;
				const result = convertImportedPage({
					source,
					title: document.name,
					fromPath: node.filePath as string,
					links: this.links,
					resolve: (target) => {
						const ref = this.created.get(target.key);
						return ref ? { documentId: ref.id, name: ref.name, mimeType: ref.mimeType, size: ref.fileSize } : null;
					}
				});
				const mentioned = result.mentionedDocumentIds.filter((id) => id !== document.id) as ID[];
				// A page saved meanwhile (by a member, or by an earlier run of this import) keeps what it has, and is linked
				// only to the pages it still mentions: a mention a member removed is not linked again, while a retry still
				// links what an earlier run wrote before it stopped.
				const written = await this.store.writePage(document, this.scope, result.contentJson, this.owner);
				const saved = written ? null : await this.store.mentionsOf(document.id, this.scope);
				await this.store.linkPages(document.id, saved ? mentioned.filter((id) => saved.has(String(id))) : mentioned, this.scope);
				this.report.set(node.key, {
					...item,
					...(result.unresolvedLinks ? { unresolvedLinks: result.unresolvedLinks } : {}),
					...(result.schemaFallback ? { reason: DOCS_IMPORT_REASONS.PLAIN_TEXT } : {})
				});
			} catch (error) {
				if (error instanceof ImportRunDisplacedError || !this.finalAttempt) throw error;
				this.logger.warn(`docs.import ${this.row.id}: page ${node.key} could not be converted: ${(error as Error)?.message ?? error}`);
				this.report.set(node.key, { ...item, status: DocumentImportItemStatusEnum.FAILED, reason: DOCS_IMPORT_REASONS.CONVERSION_FAILED });
			}
			await this.tick();
		}
	}

	/** A folder, or a page (read for its metadata and the attachments it shows). */
	private async containerOrPage(node: IImportPlanNode): Promise<void> {
		const parentId = this.parentIdOf(node.parentKey);
		if (parentId === undefined) {
			this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.SKIPPED, { reason: DOCS_IMPORT_REASONS.PARENT_MISSING }));
			await this.tick();
			return;
		}
		let name = node.name;
		let meta: IImportPageMeta = {};
		let pageProblem: string | null = null;
		if (node.kind === DocumentKindEnum.PAGE) {
			try {
				const source = await this.readPage(node);
				if (source) {
					meta = source.meta;
					this.collectAttachments(node, source);
				}
			} catch (error) {
				pageProblem = error instanceof ImportArchiveError ? DOCS_IMPORT_REASONS.TOO_LARGE : DOCS_IMPORT_REASONS.READ_FAILED;
			}
			const entry = this.entries.get(node.filePath as string);
			if (entry?.encrypted) pageProblem = DOCS_IMPORT_REASONS.ENCRYPTED;
			else if ((entry?.size ?? 0) > DOCS_IMPORT_MAX_PAGE_BYTES) pageProblem = DOCS_IMPORT_REASONS.TOO_LARGE;
			if (meta.title) name = meta.title;
			this.metaOf.set(node.key, meta);
		}
		try {
			const externalId = externalIdOf(node.key);
			const existing = await this.store.findImported(this.scope, this.externalSource, externalId);
			// Made by an earlier run, which may have stopped before stamping its owner: stamped again.
			if (existing) await this.store.adoptImported(existing.id, this.owner, meta.createdAt);
			const document =
				existing ??
				(await this.store.createNode({
					scope: this.scope,
					kind: node.kind as DocumentKindEnum.FOLDER | DocumentKindEnum.PAGE,
					name,
					parentId,
					index: node.index,
					...(meta.icon ? { icon: meta.icon } : {}),
					...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
					visibility: this.visibility,
					organizationTeamId: this.organizationTeamId,
					externalSource: this.externalSource,
					externalId,
					ownerUserId: this.owner,
					metadata: { import: { importId: this.row.id, path: node.key } }
				}));
			this.created.set(node.key, document);
			if (node.kind === DocumentKindEnum.PAGE && !pageProblem) this.pagesToWrite.add(node.key);
			// A page whose file could not be read is still created (its sub-pages and links need it), empty, and failed.
			this.report.set(
				node.key,
				pageProblem
					? this.item(node, DocumentImportItemStatusEnum.FAILED, { documentId: document.id, name: document.name, reason: pageProblem })
					: this.item(node, DocumentImportItemStatusEnum.IMPORTED, { documentId: document.id, name: document.name })
			);
		} catch (error) {
			if (error instanceof ImportRunDisplacedError || !this.finalAttempt) throw error;
			this.logger.warn(`docs.import ${this.row.id}: ${node.kind} ${node.key} could not be created: ${(error as Error)?.message ?? error}`);
			this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.FAILED, { reason: DOCS_IMPORT_REASONS.CREATE_FAILED }));
		}
		await this.tick();
	}

	/** An attachment, through the upload checks; returns the organization's usage after it. */
	private async attachment(node: IImportPlanNode, usedBytes: number): Promise<number> {
		const entry = this.entries.get(node.filePath as string) as IImportArchiveEntry;
		const externalId = externalIdOf(node.key);
		const skip = async (reason: string): Promise<number> => {
			this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.SKIPPED, { reason }));
			await this.tick();
			return usedBytes;
		};
		try {
			const existing = await this.store.findImported(this.scope, this.externalSource, externalId);
			if (existing) {
				await this.store.adoptImported(existing.id, this.owner);
				this.created.set(node.key, existing);
				this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.IMPORTED, { documentId: existing.id, name: existing.name }));
				await this.tick();
				return usedBytes;
			}
			if (entry.encrypted) return skip(DOCS_IMPORT_REASONS.ENCRYPTED);
			if (entry.size > this.options.maxFileSize) return skip(DOCS_IMPORT_REASONS.TOO_LARGE);
			if (this.options.quotaBytes > 0 && usedBytes + entry.size > this.options.quotaBytes) return skip(DOCS_IMPORT_REASONS.QUOTA_EXCEEDED);
			const buffer = await entry.read();
			if (buffer.length > this.options.maxFileSize) return skip(DOCS_IMPORT_REASONS.TOO_LARGE);
			const sniff = sniffFile(buffer, node.name);
			if (!sniff.ok) return skip(DOCS_IMPORT_REASONS.UNSUPPORTED_TYPE);
			const parentKey = this.firstPageOf.get(node.key) ?? node.parentKey;
			const parentId = this.parentIdOf(parentKey) ?? this.parentIdOf(node.parentKey);
			if (parentId === undefined) return skip(DOCS_IMPORT_REASONS.PARENT_MISSING);
			const document = await this.store.createFile({
				scope: this.scope,
				kind: DocumentKindEnum.FILE,
				name: node.name,
				parentId,
				index: node.index,
				visibility: this.visibility,
				organizationTeamId: this.organizationTeamId,
				externalSource: this.externalSource,
				externalId,
				ownerUserId: this.owner,
				metadata: { import: { importId: this.row.id, path: node.key } },
				buffer,
				mimeType: sniff.type.mimeType,
				sha256: createHash('sha256').update(buffer).digest('hex'),
				importToKnowledge: this.options.importToKnowledge
			});
			this.created.set(node.key, document);
			this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.IMPORTED, { documentId: document.id, name: document.name }));
			await this.tick();
			return usedBytes + buffer.length;
		} catch (error) {
			// The run lost the import (its progress write was refused): it stops, as everywhere else.
			if (error instanceof ImportRunDisplacedError) throw error;
			if (error instanceof ImportArchiveError) return skip(DOCS_IMPORT_REASONS.TOO_LARGE);
			if (!this.finalAttempt) throw error;
			this.logger.warn(`docs.import ${this.row.id}: attachment ${node.key} failed: ${(error as Error)?.message ?? error}`);
			this.report.set(node.key, this.item(node, DocumentImportItemStatusEnum.FAILED, { reason: DOCS_IMPORT_REASONS.CREATE_FAILED }));
			await this.tick();
			return usedBytes;
		}
	}

	/** Reads and parses a page file; null when it is encrypted or too large to read. */
	private async readPage(node: IImportPlanNode): Promise<IImportPageSource | null> {
		const entry = this.entries.get(node.filePath as string);
		if (!entry || entry.encrypted || entry.size > DOCS_IMPORT_MAX_PAGE_BYTES) return null;
		const text = (await entry.read()).toString('utf8');
		return readImportPage(text, node.format ?? 'markdown', this.plan.layout);
	}

	/** Records the attachments a page shows, for the first page of each. */
	private collectAttachments(node: IImportPlanNode, source: IImportPageSource): void {
		convertImportedPage({
			source,
			title: node.name,
			fromPath: node.filePath as string,
			links: this.links,
			resolve: (target) => {
				if (target.kind === 'file' && !this.firstPageOf.has(target.key)) this.firstPageOf.set(target.key, node.key);
				return null;
			}
		});
	}

	/** The id of the document a parent key stands for: the import's target for none, undefined when it was not created. */
	private parentIdOf(parentKey: string | null): ID | null | undefined {
		if (parentKey === null) return this.row.parentId ?? null;
		return this.created.get(parentKey)?.id;
	}

	private item(node: IImportPlanNode, status: DocumentImportItemStatusEnum, extra: Partial<IDocumentImportReportItem> = {}): IDocumentImportReportItem {
		return { path: node.key, kind: node.kind, status, name: extra.name ?? node.name, ...extra };
	}

	/** Counts one item, saving the progress every few. */
	private async tick(): Promise<void> {
		this.processed += 1;
		if (this.processed % DOCS_IMPORT_PROGRESS_EVERY === 0) {
			const written = await this.store.update(
				this.row.id,
				this.scope,
				{ processedItems: this.processed, lastProgressAt: new Date(), ...this.counts() },
				this.fence
			);
			if (!written) throw new ImportRunDisplacedError(this.row.id);
		}
	}
}
