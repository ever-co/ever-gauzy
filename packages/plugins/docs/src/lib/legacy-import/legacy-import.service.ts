import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID,
	PermissionsEnum
} from '@gauzy/contracts';
import { EventBus, OrganizationDocument, RequestContext, prepareSQLQuery as p } from '@gauzy/core';
import { HelpCenter, HelpCenterArticle, HelpCenterArticleVersion, HelpCenterAuthor } from '@gauzy/plugin-knowledge-base';
import { Document } from '../entities/document.entity';
import { DocumentLink } from '../entities/document-link.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { DocumentEvent } from '../events/document.event';
import { ImportLegacyDTO, LegacyMigrationStatusQueryDTO, RollbackLegacyDTO } from './dto';
import {
	ILegacyImportRecord,
	ILegacyImportReport,
	ILegacyImportTotals,
	ILegacyMigrationStatus,
	ILegacyRollbackRecord,
	ILegacyRollbackReport,
	LEGACY_CONTAINER_EXTERNAL_ID,
	LEGACY_EXTERNAL_SOURCES,
	LEGACY_IMPORT_SOURCES,
	LEGACY_RECOVERED_EXTERNAL_ID,
	LEGACY_SOURCE_HELP_CENTER,
	LEGACY_SOURCE_HELP_CENTER_ARTICLE,
	LEGACY_SOURCE_ORG_DOCUMENT,
	LegacyImportAction,
	LegacyImportRecordSource,
	LegacyImportSource,
	LegacyImportWarning
} from './legacy-import.types';
import { mapHelpCenterArticle, mapHelpCenterNode } from './mappers/help-center.mapper';
import { resolveDuplicateName } from './mappers/mapping.utils';
import { mapOrganizationDocument } from './mappers/organization-document.mapper';

/** Sentinel parent key of the tree root in the sibling-name / index bookkeeping maps. */
const ROOT_KEY = '__root__';

/** How many legacy records are processed between progress log lines (§5.2 batching). */
const IMPORT_BATCH_SIZE = 100;

/** Advisory-lock TTL of one migration run (§5.2). */
const MIGRATION_LOCK_TTL_MS = 30 * 60 * 1000;

/** Name of the container folder holding migrated organization documents (§6.1). */
const ORG_DOCUMENTS_CONTAINER_NAME = 'Organization Documents';
/** Icon of the container folder (§6.1). */
const ORG_DOCUMENTS_CONTAINER_ICON = 'far fa-file-alt';
/** Name of the lazily created recovered container for dangling articles (§7 case 7). */
const RECOVERED_CONTAINER_NAME = 'Help Center (recovered)';

/**
 * A node placed by the run — either newly created or resolved to a pre-existing migrated row.
 * `documentId` is `null` on dry runs; `key` is the stable bookkeeping key used for the
 * sibling-name and index maps so a dry run resolves the same tree shape as a real run.
 */
interface IPlacedNode {
	documentId: ID | null;
	key: string;
}

/**
 * Per-run state threaded through the phase helpers.
 */
interface IImportContext {
	tenantId: ID;
	organizationId: ID;
	dryRun: boolean;
	reportId: string;
	importedAt: string;
	requestedByUserId: ID | null;
	report: ILegacyImportReport;
	/** `${externalSource}:${externalId}` → existing Document id (soft-deleted rows included). */
	existing: Map<string, ID>;
	/** Parent key → lowercased sibling names already taken. */
	siblingNames: Map<string, Set<string>>;
	/** Parent key → next free sibling `index`. */
	nextIndex: Map<string, number>;
	/** Legacy row id → its placement in the new tree. */
	placed: Map<string, IPlacedNode>;
	/** Legacy article ids created in this run (versions are imported for these only, §6.5). */
	createdArticleIds: Set<string>;
}

/**
 * Orchestrates the one-way, idempotent legacy import of **Organization Documents** and the
 * **Help Center** into `Document` rows (09-consolidation-migration.md).
 *
 * Invariants:
 * - **Legacy rows are read-only inputs.** Nothing in this service writes to
 *   `organization_document`, `image_asset`, `knowledge_base*`. Provenance lives entirely on
 *   the new side (`externalSource` / `externalId` / `metadata.migration`).
 * - **No file bytes move.** A migrated FILE reuses the legacy asset's storage provider + key.
 * - **Idempotent** through the partial unique index `UQ_document_external_provenance`: a legacy
 *   row that already produced a Document — including archived and soft-deleted copies — is
 *   reported `skipped-existing` and never written twice.
 * - **Nothing is auto-indexed**: every migrated row lands with `knowledgeStatus: NONE`.
 */
@Injectable()
export class LegacyImportService {
	private readonly logger = new Logger(LegacyImportService.name);

	/**
	 * In-process advisory locks (`key → expiry epoch ms`). The spec calls for a Redis advisory
	 * lock; the plugin has no Redis seam of its own, so this guards the single-node case and
	 * the DB unique index remains the real cross-node idempotency backbone.
	 */
	private readonly locks = new Map<string, number>();

	/**
	 * Last finished report per organization (`key → report`), so `GET /migrations/status` can
	 * answer "what did the run that just held this lock do?".
	 *
	 * In-process and deliberately un-persisted, exactly like {@link locks}: the durable record of a
	 * migration is the `metadata.migration.reportId` stamped on every row it created. This map only
	 * saves the admin who is polling from re-running a dry run to find out.
	 */
	private readonly lastReports = new Map<string, ILegacyImportReport | ILegacyRollbackReport>();

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly _eventBus: EventBus
	) {}

	/*
	|--------------------------------------------------------------------------
	| Public API
	|--------------------------------------------------------------------------
	*/

	/**
	 * Runs (or dry-runs) the legacy import for one organization and returns the §5.4 report.
	 *
	 * @param input The validated request body.
	 * @returns The per-record import report.
	 */
	async importLegacy(input: ImportLegacyDTO): Promise<ILegacyImportReport> {
		const { tenantId, organizationId } = this.resolveScope(input);
		const dryRun = input.dryRun !== false; // safe default: dry-run unless explicitly disabled
		const sources = this.resolveSources(input.sources);
		const lockKey = this.lockKey(tenantId, organizationId);

		this.acquireLock(lockKey);
		try {
			const ctx = await this.createContext(tenantId, organizationId, dryRun, sources);

			if (sources.includes('organization-document')) {
				await this.importOrganizationDocuments(ctx);
			}
			if (sources.includes('help-center')) {
				await this.importHelpCenter(ctx);
			}

			ctx.report.finishedAt = new Date().toISOString();
			this.logger.log(
				`Legacy import ${ctx.reportId} (${dryRun ? 'dry-run' : 'real'}) finished for org ${organizationId}: ` +
					`${ctx.report.records.length} records`
			);
			this.lastReports.set(lockKey, ctx.report);
			return ctx.report;
		} finally {
			this.locks.delete(lockKey);
		}
	}

	/**
	 * `GET /migrations/status` — whether a migration currently holds this organization's lock, and
	 * the report of the last one that finished in this process (§5.1).
	 *
	 * The lock of §5.2 is in-process and, until this endpoint existed, entirely unobservable: an
	 * admin who hit `409 migration-in-progress` had no way to poll for it clearing other than
	 * re-issuing the import. Read-only and side-effect free — polling it never takes the lock.
	 *
	 * @param input The (optional) tenant/organization scope; both fall back to the request context.
	 * @returns The lock state and the last report this process produced.
	 */
	getStatus(input: LegacyMigrationStatusQueryDTO = {}): ILegacyMigrationStatus {
		const tenantId = input.tenantId || RequestContext.currentTenantId();
		const organizationId = input.organizationId || RequestContext.currentOrganizationId();
		if (!tenantId || !organizationId) {
			throw new BadRequestException('Both `tenantId` and `organizationId` are required');
		}

		const lockKey = this.lockKey(tenantId, organizationId);
		const heldUntil = this.locks.get(lockKey);
		const locked = Boolean(heldUntil && heldUntil > Date.now());
		return {
			locked,
			lockedUntil: locked ? new Date(heldUntil as number).toISOString() : null,
			lastReport: this.lastReports.get(lockKey) ?? null
		};
	}

	/**
	 * Soft-deletes the documents produced by a previous import (§8). Legacy data is untouched
	 * by construction — only rows carrying a migration `externalSource` are ever considered.
	 *
	 * Safety rails (`force: false`, the default):
	 * - a migrated document edited after import (`updatedAt` newer than
	 *   `metadata.migration.importedAt`, or versions added since) is skipped;
	 * - a migrated folder holding non-migrated descendants is skipped, and so are its
	 *   migrated ancestors.
	 *
	 * With `force: true` the rails are bypassed and non-migrated descendants of a removed
	 * folder are **promoted to the root** — never deleted.
	 *
	 * @param input The validated request body.
	 * @returns The per-record rollback report.
	 */
	async rollbackLegacy(input: RollbackLegacyDTO): Promise<ILegacyRollbackReport> {
		// §8 requires DOCS_MANAGE **and** DOCS_DELETE; `PermissionGuard` is OR-based, so the
		// second permission is asserted here rather than widening the route decorator.
		if (!RequestContext.hasPermission(PermissionsEnum.DOCS_DELETE)) {
			throw new ForbiddenException('Rolling back a legacy import requires DOCS_DELETE');
		}

		const { tenantId, organizationId } = this.resolveScope(input);
		const dryRun = input.dryRun !== false;
		const force = input.force === true;
		const sources = this.resolveSources(input.sources);
		const externalSources = this.externalSourcesFor(sources);
		const lockKey = this.lockKey(tenantId, organizationId);

		this.acquireLock(lockKey);
		try {
			const report: ILegacyRollbackReport = {
				reportId: randomUUID(),
				dryRun,
				force,
				tenantId,
				organizationId,
				requestedByUserId: RequestContext.currentUserId() ?? null,
				sources,
				startedAt: new Date().toISOString(),
				finishedAt: null as unknown as string,
				totals: { scanned: 0, deleted: 0, skippedModified: 0, skippedHasChildren: 0 },
				records: []
			};

			const documentRepository = this.dataSource.getRepository(Document);
			const all = await documentRepository.find({
				where: { tenantId, organizationId },
				order: { createdAt: 'ASC' }
			});

			const migrated = all.filter(
				(doc) => doc.externalSource && externalSources.includes(doc.externalSource) && !doc.deletedAt
			);
			const migratedIds = new Set(migrated.map((doc) => doc.id));
			report.totals.scanned = migrated.length;

			// Which migrated folders (transitively) contain documents the migration did not create.
			const blockedByChildren = force ? new Set<ID>() : this.findBlockedByForeignChildren(all, migratedIds);

			// Version rows per document — a version added after import means the user worked on it.
			const versionRows: { documentId: ID; createdAt?: Date }[] = migrated.length
				? await this.dataSource.getRepository(DocumentVersion).find({
						where: { tenantId, organizationId },
						select: { id: true, documentId: true, createdAt: true }
				  })
				: [];

			for (const document of migrated) {
				report.records.push(
					await this.rollbackOneDocument(document, {
						tenantId,
						dryRun,
						force,
						migratedIds,
						blockedByChildren,
						versionRows,
						totals: report.totals
					})
				);
			}

			report.finishedAt = new Date().toISOString();
			this.logger.log(
				`Legacy rollback ${report.reportId} (${dryRun ? 'dry-run' : 'real'}) for org ${organizationId}: ` +
					`${report.totals.deleted} soft-deleted, ${report.totals.skippedModified} modified, ` +
					`${report.totals.skippedHasChildren} with foreign children`
			);
			this.lastReports.set(lockKey, report);
			return report;
		} finally {
			this.locks.delete(lockKey);
		}
	}

	/**
	 * Applies the §8 rollback rails to one migrated document and, when they pass, soft-deletes
	 * it. The matching counter is moved here; the caller only appends the returned record.
	 *
	 * A failed soft-delete is reported as a warning on the record — the action stays `deleted`
	 * but `totals.deleted` is deliberately NOT incremented, so the totals never over-report.
	 *
	 * @param document The migrated document being rolled back.
	 * @param context The per-run rollback state.
	 * @returns The report record for this document.
	 */
	private async rollbackOneDocument(
		document: Document,
		context: {
			tenantId: ID;
			dryRun: boolean;
			force: boolean;
			migratedIds: Set<ID>;
			blockedByChildren: Set<ID>;
			versionRows: { documentId: ID; createdAt?: Date }[];
			totals: ILegacyRollbackReport['totals'];
		}
	): Promise<ILegacyRollbackRecord> {
		const { tenantId, dryRun, force, migratedIds, blockedByChildren, versionRows, totals } = context;

		const record: ILegacyRollbackRecord = {
			source: document.externalSource,
			externalId: document.externalId ?? null,
			legacyName: document.name ?? null,
			action: 'deleted',
			documentId: document.id,
			warnings: []
		};

		if (!force && blockedByChildren.has(document.id)) {
			record.action = 'skipped-has-children';
			totals.skippedHasChildren++;
			return record;
		}
		if (!force && this.wasModifiedAfterImport(document, versionRows)) {
			record.action = 'skipped-modified';
			totals.skippedModified++;
			return record;
		}

		if (!dryRun) {
			try {
				await this.softDeleteMigratedDocument(document, tenantId, force, migratedIds);
				this.emitEvent(document, 'deleted');
			} catch (error) {
				record.warnings.push(`soft-delete-failed: ${(error as Error).message}`);
				return record;
			}
		}

		totals.deleted++;
		return record;
	}

	/**
	 * Soft-deletes one migrated document inside its own transaction. With `force`, its foreign
	 * (non-migrated) children are first promoted to the root — they are never deleted (§8).
	 *
	 * @param document The document to soft-delete.
	 * @param tenantId The run's tenant scope.
	 * @param force Whether the promote-children semantics apply.
	 * @param migratedIds Every document id this rollback owns (its children stay parented).
	 */
	private async softDeleteMigratedDocument(
		document: Document,
		tenantId: ID,
		force: boolean,
		migratedIds: Set<ID>
	): Promise<void> {
		await this.dataSource.transaction(async (manager: EntityManager) => {
			if (force) {
				// Promote-children semantics — foreign descendants are never deleted.
				await manager
					.getRepository(Document)
					.createQueryBuilder()
					.update(Document)
					.set({ parentId: null })
					.where(p('"parentId" = :parentId'), { parentId: document.id })
					.andWhere(p('"id" NOT IN (:...migratedIds)'), {
						migratedIds: [...migratedIds]
					})
					.execute();
			}
			await manager.getRepository(Document).softDelete({ id: document.id, tenantId });
		});
	}

	/*
	|--------------------------------------------------------------------------
	| Phase 1 — organization documents (§6.1 / §6.2)
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates (or reuses) the container folder and imports every `organization_document` row.
	 *
	 * @param ctx The run context.
	 */
	private async importOrganizationDocuments(ctx: IImportContext): Promise<void> {
		const totals = ctx.report.totals.organizationDocuments;

		const container = await this.ensureSystemFolder(
			ctx,
			LEGACY_SOURCE_ORG_DOCUMENT,
			LEGACY_CONTAINER_EXTERNAL_ID,
			ORG_DOCUMENTS_CONTAINER_NAME,
			ORG_DOCUMENTS_CONTAINER_ICON,
			totals
		);

		const legacyRows = await this.dataSource.getRepository(OrganizationDocument).find({
			where: { tenantId: ctx.tenantId, organizationId: ctx.organizationId },
			withDeleted: true,
			order: { createdAt: 'ASC' }
		});

		let processed = 0;
		for (const legacy of legacyRows) {
			totals.scanned++;
			processed++;

			if (legacy.deletedAt) {
				this.pushRecord(ctx, totals, {
					source: 'organization-document',
					externalId: legacy.id,
					legacyName: legacy.name ?? null,
					action: 'skipped-deleted',
					documentId: null,
					parentDocumentId: container.documentId,
					warnings: [],
					error: null
				});
				continue;
			}

			const existingId = ctx.existing.get(this.provenanceKey(LEGACY_SOURCE_ORG_DOCUMENT, legacy.id));
			if (existingId) {
				this.pushRecord(ctx, totals, {
					source: 'organization-document',
					externalId: legacy.id,
					legacyName: legacy.name ?? null,
					action: 'skipped-existing',
					documentId: existingId,
					parentDocumentId: container.documentId,
					warnings: [],
					error: null
				});
				continue;
			}

			const { fields, warnings } = mapOrganizationDocument(legacy as any);
			await this.createFromMapping(ctx, totals, {
				recordSource: 'organization-document',
				externalId: legacy.id,
				legacyName: legacy.name,
				desiredName: legacy.name,
				parent: container,
				fields,
				warnings,
				legacyRow: legacy
			});

			if (processed % IMPORT_BATCH_SIZE === 0) {
				this.logger.debug(`Legacy import ${ctx.reportId}: ${processed} organization documents processed`);
			}
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Phase 2 — help center (§6.3 / §6.4 / §6.5)
	|--------------------------------------------------------------------------
	*/

	/**
	 * Imports the help-center tree: nodes (bases + categories) first, then articles
	 * (pass A placement by category, pass B article-nesting re-parent), then versions.
	 *
	 * @param ctx The run context.
	 */
	private async importHelpCenter(ctx: IImportContext): Promise<void> {
		await this.importHelpCenterNodes(ctx);
		await this.importHelpCenterArticles(ctx);
	}

	/**
	 * Imports `knowledge_base` nodes as FOLDER documents in parent-before-child order.
	 * Placement is positional; `flag` only feeds the warning codes (§7 cases 5/6).
	 *
	 * @param ctx The run context.
	 */
	private async importHelpCenterNodes(ctx: IImportContext): Promise<void> {
		const totals = ctx.report.totals.helpCenterNodes;
		const nodes = await this.findLegacy(ctx, HelpCenter);
		if (!nodes.length) {
			return;
		}

		const byId = new Map<string, HelpCenter>(nodes.map((node) => [node.id as string, node]));
		const ordered = [...nodes].sort((a, b) => {
			const depthDelta = this.legacyDepth(a, byId) - this.legacyDepth(b, byId);
			if (depthDelta !== 0) {
				return depthDelta;
			}
			return (a.index ?? 0) - (b.index ?? 0);
		});

		for (const node of ordered) {
			totals.scanned++;

			if (node.deletedAt) {
				this.pushRecord(ctx, totals, {
					source: 'help-center',
					externalId: node.id as string,
					legacyName: node.name ?? null,
					action: 'skipped-deleted',
					documentId: null,
					parentDocumentId: null,
					warnings: [],
					error: null
				});
				continue;
			}

			const parent = node.parentId ? ctx.placed.get(node.parentId) ?? null : null;
			const existingId = ctx.existing.get(this.provenanceKey(LEGACY_SOURCE_HELP_CENTER, node.id as string));
			if (existingId) {
				// Register the placement so descendants resolve against the pre-existing copy.
				ctx.placed.set(node.id as string, { documentId: existingId, key: existingId });
				this.pushRecord(ctx, totals, {
					source: 'help-center',
					externalId: node.id as string,
					legacyName: node.name ?? null,
					action: 'skipped-existing',
					documentId: existingId,
					parentDocumentId: parent?.documentId ?? null,
					warnings: [],
					error: null
				});
				continue;
			}

			const { fields, warnings } = mapHelpCenterNode(node as any, { parentResolved: Boolean(parent) });
			await this.createFromMapping(ctx, totals, {
				recordSource: 'help-center',
				externalId: node.id as string,
				legacyName: node.name,
				desiredName: node.name,
				parent,
				fields,
				warnings,
				legacyRow: node,
				registerPlacement: node.id as string
			});
		}
	}

	/**
	 * Imports `knowledge_base_article` rows as PAGE documents, then their versions, tags and
	 * project links. Pass B re-parents nested articles under their mapped parent PAGE.
	 *
	 * @param ctx The run context.
	 */
	private async importHelpCenterArticles(ctx: IImportContext): Promise<void> {
		const totals = ctx.report.totals.helpCenterArticles;
		const articles = await this.findLegacy(ctx, HelpCenterArticle, ['tags', 'projects']);
		if (!articles.length) {
			return;
		}

		const authors = await this.findLegacy(ctx, HelpCenterAuthor);
		const authorsByArticle = new Map<string, string[]>();
		for (const author of authors) {
			if (author.deletedAt || !author.articleId) {
				continue;
			}
			const list = authorsByArticle.get(author.articleId) ?? [];
			list.push(author.employeeId);
			authorsByArticle.set(author.articleId, list);
		}

		let recovered: IPlacedNode | null = null;
		const ordered = [...articles].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

		// Pass A — placement under the mapped category (or the lazily created recovered folder).
		for (const article of ordered) {
			totals.scanned++;

			if (article.deletedAt) {
				this.pushRecord(ctx, totals, {
					source: 'help-center-article',
					externalId: article.id as string,
					legacyName: article.name ?? null,
					action: 'skipped-deleted',
					documentId: null,
					parentDocumentId: null,
					warnings: [],
					error: null
				});
				continue;
			}

			let parent = article.categoryId ? ctx.placed.get(article.categoryId) ?? null : null;
			const warnings: LegacyImportWarning[] = [];
			if (!parent) {
				// §7 case 7 — dangling category reference: park under the recovered container.
				recovered =
					recovered ??
					(await this.ensureSystemFolder(
						ctx,
						LEGACY_SOURCE_HELP_CENTER,
						LEGACY_RECOVERED_EXTERNAL_ID,
						RECOVERED_CONTAINER_NAME,
						null,
						ctx.report.totals.helpCenterNodes
					));
				parent = recovered;
				warnings.push('orphaned-category');
			}

			const existingId = ctx.existing.get(
				this.provenanceKey(LEGACY_SOURCE_HELP_CENTER_ARTICLE, article.id as string)
			);
			if (existingId) {
				ctx.placed.set(article.id as string, { documentId: existingId, key: existingId });
				this.pushRecord(ctx, totals, {
					source: 'help-center-article',
					externalId: article.id as string,
					legacyName: article.name ?? null,
					action: 'skipped-existing',
					documentId: existingId,
					parentDocumentId: parent?.documentId ?? null,
					warnings: [],
					error: null
				});
				continue;
			}

			const mapped = mapHelpCenterArticle({
				...(article as any),
				authorEmployeeIds: authorsByArticle.get(article.id as string) ?? []
			});
			// §6.4 — the same core `Tag` rows are re-linked through the `tag_document` pivot.
			if (article.tags?.length) {
				mapped.fields.tags = article.tags.map((tag) => ({ id: tag.id }));
			}
			await this.createFromMapping(ctx, totals, {
				recordSource: 'help-center-article',
				externalId: article.id as string,
				legacyName: article.name,
				desiredName: article.name,
				parent,
				fields: mapped.fields,
				warnings: [...warnings, ...mapped.warnings],
				legacyRow: article,
				registerPlacement: article.id as string,
				onCreated: async (document, manager) => {
					await this.importArticleSatellites(ctx, article, document, manager);
					ctx.createdArticleIds.add(article.id as string);
				}
			});
		}

		// Pass B — article nesting wins over the category placement when it resolves.
		await this.reparentNestedArticles(ctx, ordered);
	}

	/**
	 * Writes the versions, tag links and project links of a freshly created article PAGE inside
	 * the article's own transaction (§6.4 / §6.5).
	 *
	 * @param ctx The run context.
	 * @param article The legacy article row.
	 * @param document The created PAGE document.
	 * @param manager The transactional entity manager of the article write.
	 */
	private async importArticleSatellites(
		ctx: IImportContext,
		article: HelpCenterArticle,
		document: Document,
		manager: EntityManager
	): Promise<void> {
		const versionTotals = ctx.report.totals.helpCenterVersions;

		// Project associations become DocumentLink rows (§6.4). `document_link` has no
		// subscriber — the owning side serializes the metadata JSON on the SQLite path.
		const linkMetadata: any = { origin: 'help-center-migration' };
		for (const project of article.projects ?? []) {
			const linkRepository = manager.getRepository(DocumentLink);
			const link: DocumentLink = linkRepository.create({
				tenantId: ctx.tenantId,
				organizationId: ctx.organizationId,
				documentId: document.id,
				entity: BaseEntityEnum.OrganizationProject,
				entityId: project.id,
				metadata: isSqlite() || isBetterSqlite3() ? JSON.stringify(linkMetadata) : linkMetadata
			});
			await linkRepository.save(link);
		}

		// Versions — only for articles created in this run (the §6.5 idempotency rule).
		const versions = await manager.getRepository(HelpCenterArticleVersion).find({
			where: { articleId: article.id, tenantId: ctx.tenantId, organizationId: ctx.organizationId },
			order: { lastSavedAt: 'ASC' }
		});

		for (const version of versions) {
			versionTotals.scanned++;
			const warnings: LegacyImportWarning[] = [];
			let createdById: ID | null = version.ownedById ?? null;
			if (!createdById) {
				warnings.push('unresolved-employee');
			}

			try {
				const saved = await manager.getRepository(DocumentVersion).save(
					manager.getRepository(DocumentVersion).create({
						tenantId: ctx.tenantId,
						organizationId: ctx.organizationId,
						documentId: document.id,
						name: document.name,
						contentJson: (version.descriptionJson as any) ?? null,
						contentHtml: version.descriptionHtml ?? null,
						contentBinary: this.toBuffer(version.descriptionBinary),
						lastSavedAt: version.lastSavedAt ?? version.createdAt ?? new Date(),
						createdById
					})
				);
				versionTotals.created++;
				versionTotals.warnings += warnings.length;
				ctx.report.records.push({
					source: 'help-center-version',
					externalId: version.id as string,
					legacyName: document.name,
					action: 'created',
					documentId: saved.id,
					parentDocumentId: document.id,
					warnings,
					error: null
				});
			} catch (error) {
				versionTotals.failed++;
				ctx.report.records.push({
					source: 'help-center-version',
					externalId: version.id as string,
					legacyName: document.name,
					action: 'failed',
					documentId: null,
					parentDocumentId: document.id,
					warnings,
					error: { code: 'db-write-failed', message: (error as Error).message }
				});
			}
		}
	}

	/**
	 * Pass B (§6.4): an article's own `parentId` outranks its `categoryId` placement. Only
	 * documents created in this run are re-parented; unresolvable targets and nesting cycles
	 * keep the pass-A placement (§7 case 10).
	 *
	 * @param ctx The run context.
	 * @param articles Every scanned legacy article.
	 */
	private async reparentNestedArticles(ctx: IImportContext, articles: HelpCenterArticle[]): Promise<void> {
		const byId = new Map<string, HelpCenterArticle>(articles.map((article) => [article.id as string, article]));

		for (const article of articles) {
			const move = this.resolveNestedArticleMove(ctx, article, byId);
			if (!move) {
				continue;
			}

			if (!ctx.dryRun) {
				try {
					await this.dataSource
						.getRepository(Document)
						.update({ id: move.documentId, tenantId: ctx.tenantId }, { parentId: move.parentDocumentId });
				} catch (error) {
					this.logger.warn(
						`Legacy import ${ctx.reportId}: re-parent of ${move.documentId} failed — ${(error as Error).message}`
					);
					continue;
				}
			}

			// Reflect the final placement in the already-emitted record.
			const record = ctx.report.records.find(
				(candidate) => candidate.source === 'help-center-article' && candidate.externalId === move.articleId
			);
			if (record) {
				record.parentDocumentId = move.parentDocumentId;
			}
		}
	}

	/**
	 * Decides whether one article moves under its own `parentId` (§6.4 pass B), and to where.
	 *
	 * Returns `null` — the pass-A category placement stands — when the article was not created
	 * in this run, its nesting target is unresolvable, its nesting chain loops (§7 case 10), or
	 * it already sits under that parent.
	 *
	 * @param ctx The run context.
	 * @param article The legacy article row.
	 * @param byId Every scanned article by legacy id (cycle detection).
	 * @returns The move to apply, or null to keep the pass-A placement.
	 */
	private resolveNestedArticleMove(
		ctx: IImportContext,
		article: HelpCenterArticle,
		byId: Map<string, HelpCenterArticle>
	): { articleId: string; documentId: ID; parentDocumentId: ID } | null {
		const articleId = article.id as string;
		if (!article.parentId || article.deletedAt || !ctx.createdArticleIds.has(articleId)) {
			return null;
		}
		const target = ctx.placed.get(article.parentId);
		if (!target?.documentId) {
			return null; // unresolvable — keep the pass-A placement
		}
		if (this.hasNestingCycle(articleId, byId)) {
			this.logger.warn(`Legacy import ${ctx.reportId}: article ${articleId} nesting cycle — keeping category placement`);
			return null;
		}

		const self = ctx.placed.get(articleId);
		if (!self?.documentId || self.documentId === target.documentId) {
			return null;
		}

		return { articleId, documentId: self.documentId, parentDocumentId: target.documentId };
	}

	/*
	|--------------------------------------------------------------------------
	| Write helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates (or reuses) one of the system folders — the org-documents container (§6.1) and the
	 * recovered help-center container (§7 case 7) — which participate in the same provenance
	 * scheme through their sentinel `externalId` values.
	 *
	 * @param ctx The run context.
	 * @param externalSource The provenance namespace.
	 * @param externalId The sentinel external id.
	 * @param name The folder name.
	 * @param icon The folder icon (or null).
	 * @param totals The totals bucket the folder counts against.
	 * @returns The placement of the folder.
	 */
	private async ensureSystemFolder(
		ctx: IImportContext,
		externalSource: string,
		externalId: string,
		name: string,
		icon: string | null,
		totals: ILegacyImportTotals
	): Promise<IPlacedNode> {
		totals.scanned++;

		const existingId = ctx.existing.get(this.provenanceKey(externalSource, externalId));
		if (existingId) {
			this.pushRecord(ctx, totals, {
				source: externalSource === LEGACY_SOURCE_ORG_DOCUMENT ? 'organization-document' : 'help-center',
				externalId,
				legacyName: name,
				action: 'skipped-existing',
				documentId: existingId,
				parentDocumentId: null,
				warnings: [],
				error: null
			});
			return { documentId: existingId, key: existingId };
		}

		const placement = await this.createFromMapping(ctx, totals, {
			recordSource: externalSource === LEGACY_SOURCE_ORG_DOCUMENT ? 'organization-document' : 'help-center',
			externalId,
			legacyName: name,
			desiredName: name,
			parent: null,
			fields: {
				kind: DocumentKindEnum.FOLDER,
				source: DocumentSourceEnum.IMPORT,
				externalSource,
				externalId,
				icon,
				status: DocumentStatusEnum.READY,
				knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
				reviewStatus: DocumentReviewStatusEnum.NONE,
				visibility: DocumentVisibilityEnum.ORGANIZATION,
				searchable: true,
				version: 1,
				metadata: {}
			},
			warnings: [],
			legacyRow: null
		});

		return placement ?? { documentId: null, key: `${externalSource}:${externalId}` };
	}

	/**
	 * Resolves the final name/index, stamps the shared migration fields, and writes one
	 * `Document` (with its satellites) in a single transaction. Dry runs perform the complete
	 * resolution and emit an identical report record without touching the database.
	 *
	 * Per-record (not per-batch) transactions are used deliberately: an article and its
	 * versions/links still share one transaction, while a single bad row can no longer fail
	 * the 99 healthy rows around it.
	 *
	 * @returns The placement of the created document (null when the write failed).
	 */
	private async createFromMapping(
		ctx: IImportContext,
		totals: ILegacyImportTotals,
		options: {
			recordSource: LegacyImportRecordSource;
			externalId: string;
			legacyName: string | null;
			desiredName: string;
			parent: IPlacedNode | null;
			fields: Record<string, any>;
			warnings: LegacyImportWarning[];
			legacyRow: { createdAt?: Date; createdByUserId?: ID; isArchived?: boolean; archivedAt?: Date } | null;
			registerPlacement?: string;
			onCreated?: (document: Document, manager: EntityManager) => Promise<void>;
		}
	): Promise<IPlacedNode | null> {
		const parentKey = options.parent?.key ?? ROOT_KEY;
		const warnings = [...options.warnings];

		// §7 case 1 — deterministic duplicate-name suffixing against live siblings.
		const taken = ctx.siblingNames.get(parentKey) ?? new Set<string>();
		const resolved = resolveDuplicateName(options.desiredName, taken);
		if (resolved.suffixed) {
			warnings.push('duplicate-name-suffixed');
		}
		taken.add(resolved.name.toLowerCase());
		ctx.siblingNames.set(parentKey, taken);

		const index = ctx.nextIndex.get(parentKey) ?? 0;
		ctx.nextIndex.set(parentKey, index + 1);

		const metadata = {
			...(options.fields.metadata ?? {}),
			migration: { importedAt: ctx.importedAt, reportId: ctx.reportId }
		} as Record<string, any>;
		if (resolved.suffixed) {
			metadata.legacy = { ...(metadata.legacy ?? {}), name: options.desiredName };
		}

		const fields: Record<string, any> = {
			...options.fields,
			tenantId: ctx.tenantId,
			organizationId: ctx.organizationId,
			name: resolved.name,
			parentId: options.parent?.documentId ?? null,
			index: options.fields.index ?? index,
			metadata,
			createdByUserId: options.legacyRow?.createdByUserId ?? ctx.requestedByUserId ?? null,
			isArchived: options.legacyRow?.isArchived ?? false,
			archivedAt: options.legacyRow?.archivedAt ?? null
		};
		if (options.legacyRow?.createdAt) {
			fields.createdAt = options.legacyRow.createdAt; // §6 — creation timestamps are preserved
		}

		if (ctx.dryRun) {
			const key = `dry:${options.recordSource}:${options.externalId}`;
			const placement: IPlacedNode = { documentId: null, key };
			if (options.registerPlacement) {
				ctx.placed.set(options.registerPlacement, placement);
			}
			totals.created++;
			totals.warnings += warnings.length;
			ctx.report.records.push({
				source: options.recordSource,
				externalId: options.externalId,
				legacyName: options.legacyName,
				action: 'created',
				documentId: null,
				parentDocumentId: options.parent?.documentId ?? null,
				warnings,
				error: null
			});
			return placement;
		}

		try {
			const saved = await this.dataSource.transaction(async (manager: EntityManager) => {
				const repository = manager.getRepository(Document);
				const entity: Document = repository.create(fields as Partial<Document>);
				const document: Document = await repository.save(entity);
				if (options.onCreated) {
					await options.onCreated(document, manager);
				}
				return document;
			});

			const placement: IPlacedNode = { documentId: saved.id, key: saved.id };
			if (options.registerPlacement) {
				ctx.placed.set(options.registerPlacement, placement);
			}
			ctx.existing.set(this.provenanceKey(options.fields.externalSource, options.externalId), saved.id);

			totals.created++;
			totals.warnings += warnings.length;
			ctx.report.records.push({
				source: options.recordSource,
				externalId: options.externalId,
				legacyName: options.legacyName,
				action: 'created',
				documentId: saved.id,
				parentDocumentId: options.parent?.documentId ?? null,
				warnings,
				error: null
			});
			this.emitEvent(saved, 'created');
			return placement;
		} catch (error) {
			totals.failed++;
			totals.warnings += warnings.length;
			ctx.report.records.push({
				source: options.recordSource,
				externalId: options.externalId,
				legacyName: options.legacyName,
				action: 'failed',
				documentId: null,
				parentDocumentId: options.parent?.documentId ?? null,
				warnings,
				error: { code: 'db-write-failed', message: (error as Error).message }
			});
			return null;
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Context + small helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * Builds the run context: the empty report plus the provenance / sibling-name / index maps
	 * derived from the organization's current `document` rows.
	 */
	private async createContext(
		tenantId: ID,
		organizationId: ID,
		dryRun: boolean,
		sources: LegacyImportSource[]
	): Promise<IImportContext> {
		const rows = await this.dataSource.getRepository(Document).find({
			where: { tenantId, organizationId },
			withDeleted: true, // archived + soft-deleted copies must still block a re-import
			select: {
				id: true,
				name: true,
				parentId: true,
				index: true,
				externalSource: true,
				externalId: true,
				deletedAt: true
			}
		});

		const existing = new Map<string, ID>();
		const siblingNames = new Map<string, Set<string>>();
		const nextIndex = new Map<string, number>();

		for (const row of rows) {
			if (row.externalSource && LEGACY_EXTERNAL_SOURCES.includes(row.externalSource) && row.externalId) {
				existing.set(this.provenanceKey(row.externalSource, row.externalId), row.id);
			}
			if (row.deletedAt) {
				continue; // a soft-deleted row neither owns a name nor an order slot
			}
			const parentKey = row.parentId ?? ROOT_KEY;
			const names = siblingNames.get(parentKey) ?? new Set<string>();
			names.add(String(row.name ?? '').trim().toLowerCase());
			siblingNames.set(parentKey, names);
			nextIndex.set(parentKey, Math.max(nextIndex.get(parentKey) ?? 0, (row.index ?? 0) + 1));
		}

		const emptyTotals = (): ILegacyImportTotals => ({ scanned: 0, created: 0, skipped: 0, failed: 0, warnings: 0 });
		const reportId = randomUUID();

		return {
			tenantId,
			organizationId,
			dryRun,
			reportId,
			importedAt: new Date().toISOString(),
			requestedByUserId: RequestContext.currentUserId() ?? null,
			existing,
			siblingNames,
			nextIndex,
			placed: new Map(),
			createdArticleIds: new Set(),
			report: {
				reportId,
				dryRun,
				tenantId,
				organizationId,
				requestedByUserId: RequestContext.currentUserId() ?? null,
				sources,
				startedAt: new Date().toISOString(),
				finishedAt: null as unknown as string,
				totals: {
					organizationDocuments: emptyTotals(),
					helpCenterNodes: emptyTotals(),
					helpCenterArticles: emptyTotals(),
					helpCenterVersions: emptyTotals()
				},
				records: []
			}
		};
	}

	/**
	 * Loads legacy rows of one entity for the run's tenant/organization, soft-deleted rows
	 * included so they can be reported as `skipped-deleted`. A missing entity registration
	 * (the knowledge-base plugin is not deployed) degrades to an empty result.
	 */
	private async findLegacy<T>(ctx: IImportContext, entity: new () => T, relations: string[] = []): Promise<T[]> {
		try {
			return (await this.dataSource.getRepository(entity).find({
				where: { tenantId: ctx.tenantId, organizationId: ctx.organizationId } as any,
				withDeleted: true,
				relations: relations as any,
				order: { createdAt: 'ASC' } as any
			})) as T[];
		} catch (error) {
			this.logger.warn(
				`Legacy import ${ctx.reportId}: ${(entity as any)?.name} is not available in this deployment — ` +
					`${(error as Error).message}`
			);
			return [];
		}
	}

	/**
	 * Appends a non-creating record to the report and moves the matching counter.
	 */
	private pushRecord(ctx: IImportContext, totals: ILegacyImportTotals, record: ILegacyImportRecord): void {
		const skipping: LegacyImportAction[] = ['skipped-existing', 'skipped-deleted'];
		if (skipping.includes(record.action)) {
			totals.skipped++;
		} else if (record.action === 'failed') {
			totals.failed++;
		}
		totals.warnings += record.warnings.length;
		ctx.report.records.push(record);
	}

	/**
	 * `${externalSource}:${externalId}` — the provenance lookup key.
	 */
	private provenanceKey(externalSource: string, externalId: string): string {
		return `${externalSource}:${externalId}`;
	}

	/**
	 * Depth of a legacy tree node, cycle-safe (a cycle resolves to depth 0 → root placement).
	 */
	private legacyDepth(node: HelpCenter, byId: Map<string, HelpCenter>): number {
		let depth = 0;
		let current = node;
		const seen = new Set<string>([current.id as string]);
		while (current?.parentId) {
			const parent = byId.get(current.parentId);
			if (!parent || seen.has(parent.id as string)) {
				return depth;
			}
			seen.add(parent.id as string);
			current = parent;
			depth++;
		}
		return depth;
	}

	/**
	 * True when the article's nesting chain loops back on itself (§7 case 10).
	 */
	private hasNestingCycle(articleId: string, byId: Map<string, HelpCenterArticle>): boolean {
		const seen = new Set<string>([articleId]);
		let current = byId.get(articleId);
		while (current?.parentId) {
			if (seen.has(current.parentId)) {
				return true;
			}
			seen.add(current.parentId);
			current = byId.get(current.parentId);
		}
		return false;
	}

	/**
	 * Normalizes a legacy binary column into a Buffer; a driver anomaly degrades to `null`
	 * (§7 case 11 — the CRDT payload is a cache, never the canonical content).
	 */
	private toBuffer(value: Uint8Array | Buffer | null | undefined): Buffer | null {
		if (!value) {
			return null;
		}
		try {
			return Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
		} catch (error) {
			this.logger.warn(`Legacy binary content could not be copied: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Migrated documents that (transitively) contain documents the migration did not create.
	 * Those folders — and their migrated ancestors — are skipped by a non-forced rollback (§8).
	 */
	private findBlockedByForeignChildren(all: Document[], migratedIds: Set<ID>): Set<ID> {
		const byId = new Map<ID, Document>(all.map((doc) => [doc.id, doc]));
		const blocked = new Set<ID>();

		for (const document of all) {
			if (document.deletedAt || migratedIds.has(document.id)) {
				continue; // only foreign (user-created) documents block a rollback
			}
			// Walk the ancestor chain and block every migrated ancestor.
			const seen = new Set<ID>([document.id]);
			let parent = document.parentId ? byId.get(document.parentId) : null;
			while (parent && !seen.has(parent.id)) {
				seen.add(parent.id);
				if (migratedIds.has(parent.id)) {
					blocked.add(parent.id);
				}
				parent = parent.parentId ? byId.get(parent.parentId) : null;
			}
		}
		return blocked;
	}

	/**
	 * True when a migrated document was edited after the import that created it (§8 rails).
	 */
	private wasModifiedAfterImport(document: Document, versions: { documentId: ID; createdAt?: Date }[]): boolean {
		const metadata = this.readMetadata(document);
		const importedAt = metadata?.migration?.importedAt ? new Date(metadata.migration.importedAt) : null;
		if (!importedAt || Number.isNaN(importedAt.getTime())) {
			return false; // no provenance timestamp to compare against — the other rails still apply
		}
		// A small tolerance absorbs the write-time gap between `importedAt` and the row's `updatedAt`.
		const toleranceMs = 60 * 1000;
		if (document.updatedAt && document.updatedAt.getTime() > importedAt.getTime() + toleranceMs) {
			return true;
		}
		return versions.some(
			(version) =>
				version.documentId === document.id &&
				version.createdAt &&
				version.createdAt.getTime() > importedAt.getTime() + toleranceMs
		);
	}

	/**
	 * Reads the `metadata` column tolerating the SQLite text encoding.
	 */
	private readMetadata(document: Document): Record<string, any> | null {
		const raw = document.metadata as any;
		if (!raw) {
			return null;
		}
		if (typeof raw === 'string') {
			try {
				return JSON.parse(raw);
			} catch {
				return null;
			}
		}
		return raw as Record<string, any>;
	}

	/**
	 * Best-effort `DocumentEvent` emission — a failure logs and never rolls back the write.
	 */
	private emitEvent(document: Document, type: 'created' | 'deleted'): void {
		try {
			// `EventBus.publish` is `async` — see `DocumentProcessingService.emitEvent`: the
			// catch below never sees a rejection, so terminate the promise explicitly.
			this._eventBus
				.publish(new DocumentEvent(RequestContext.currentRequestContext(), document, type, { phase: 'crud' }))
				.catch((error) =>
					this.logger.warn(`Failed to publish DocumentEvent (${type}): ${(error as Error).message}`)
				);
		} catch (error) {
			this.logger.warn(`Failed to publish DocumentEvent (${type}): ${(error as Error).message}`);
		}
	}

	/**
	 * Resolves and validates the tenant/organization scope of the run.
	 */
	private resolveScope(input: ImportLegacyDTO): { tenantId: ID; organizationId: ID } {
		const tenantId = input.tenantId || RequestContext.currentTenantId();
		const organizationId = input.organizationId;
		if (!tenantId || !organizationId) {
			throw new BadRequestException('Both `tenantId` and `organizationId` are required');
		}
		return { tenantId, organizationId };
	}

	/**
	 * Normalizes the requested sources (deduplicated, both when omitted).
	 */
	private resolveSources(sources?: LegacyImportSource[]): LegacyImportSource[] {
		if (!sources?.length) {
			return [...LEGACY_IMPORT_SOURCES];
		}
		return LEGACY_IMPORT_SOURCES.filter((source) => sources.includes(source));
	}

	/**
	 * The `document.externalSource` values covered by the requested sources.
	 */
	private externalSourcesFor(sources: LegacyImportSource[]): string[] {
		const values: string[] = [];
		if (sources.includes('organization-document')) {
			values.push(LEGACY_SOURCE_ORG_DOCUMENT);
		}
		if (sources.includes('help-center')) {
			values.push(LEGACY_SOURCE_HELP_CENTER, LEGACY_SOURCE_HELP_CENTER_ARTICLE);
		}
		return values;
	}

	/**
	 * The per-organization advisory-lock key (§5.2).
	 */
	private lockKey(tenantId: ID, organizationId: ID): string {
		return `docs:migration:${tenantId}:${organizationId}`;
	}

	/**
	 * Takes the per-organization run lock; a second concurrent run is rejected with 409.
	 */
	private acquireLock(key: string): void {
		const now = Date.now();
		const heldUntil = this.locks.get(key);
		if (heldUntil && heldUntil > now) {
			throw new ConflictException({ error: 'migration-in-progress' });
		}
		this.locks.set(key, now + MIGRATION_LOCK_TTL_MS);
	}
}
