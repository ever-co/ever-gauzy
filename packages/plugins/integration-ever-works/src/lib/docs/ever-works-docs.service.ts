// cspell:ignore wikilink wikilinks unfiled
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentReviewStatusEnum,
	DocumentVisibilityEnum,
	ID,
	IInboxItemWriter,
	INBOX_ITEM_WRITER,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import type { Document } from '@gauzy/plugin-docs';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksConflictsService } from '../sync/conflicts/ever-works-conflicts.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange } from '../sync/entities/ever-works-sync.entities';
import { EverWorksNoRequestContextError, everWorksUserOfGauzyUser, gauzyUserOfActor, NO_REQUEST_CONTEXT_RETRY_MS } from '../sync/ever-works-actor';
import { runInSyncRequestContext, syncRequestUser } from '../sync/ever-works-process';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import { EverWorksSyncLoop, EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundApplier, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { fromEverWorks, toEverWorks } from '../sync/initial/ever-works-sync-phases';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { EverWorksOutboundHandler, EverWorksOutboundPusher, EverWorksPushContext, EverWorksPushOutcome } from '../sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { htmlToMarkdown } from '../tasks/ever-works-markdown';
import { documentToMarkdown, markdownHash, markdownToDocument } from './ever-works-docs-content';
import {
	cut,
	DOCS_TREE,
	DocEverWorksOnly,
	DocsPlacement,
	DocSnapshot,
	documentPathOf,
	EVER_WORKS_DOCS_SOURCE,
	everWorksClassOf,
	everWorksMetadataOf,
	FolderSnapshot,
	gauzyDescriptionOf,
	gauzyReviewOf,
	isEverWorksArchived,
	mergeMetadata
} from './ever-works-docs.mapper';
import { DocsPageFields, EverWorksDocsStore, MAX_FOLDER_DEPTH } from './ever-works-docs.store';
import { EverWorksKbDocument, EverWorksKbDocumentCreate, EverWorksKbDocumentUpdate, EverWorksKbFolder, KB_LIMITS } from './ever-works-kb.types';

/** The `kb.document.*` events that carry a document to apply (`deleted` archives, see below). */
const DOCUMENT_EVENTS = new Set([
	'kb.document.created',
	'kb.document.updated',
	'kb.document.moved',
	'kb.document.archived',
	'kb.document.unarchived',
	'kb.document.review_changed'
]);

/** The fields a push may be making when Ever Works answers 412: Ever Works' older value is not written over them. */
type KeptField = 'title' | 'description' | 'body' | 'folder';

/** The Inbox identity of a docs conflict notice (one per page, refreshed on a repeat). */
const DOCS_NOTICE_SOURCE = 'ever_works:docs';

/** A path taken in Ever Works is retried once with a suffix from the Gauzy id. */
const PATH_RETRY_ATTEMPTS = 2;

/**
 * Docs sync (plan 05, plan 06 G-P3-4): the Ever Works Knowledge Base ↔ Gauzy Docs, linked as `DOC`
 * (documents ↔ PAGE documents) and `DOC_FOLDER` (organization library folders ↔ FOLDER documents).
 *
 * **Where synced documents live.** Per mapped organization, a root folder ("Ever Works", or the folder
 * `DOCS_ROOT_FOLDER_ID` names) holds `Organization/` (organization documents, and the library folder
 * tree under it) and `Works/<Work name>/` (each Work's documents; the folder is linked to the Work's paired
 * project). The tree is created when the first Ever Works document arrives.
 *
 * - **EW → G** (`kb.document.*`, `kb.folder.*`; contract CR-7): a document's title, description, body
 *   (Markdown → TipTap, wikilinks of synced documents → document mentions), lock, review state
 *   (proposed → PENDING in the review queue, accepted → APPROVED), archive state, folder and class /
 *   tags / language / decision (kept in `metadata.everWorks`, read-only in Gauzy). Before Gauzy's content
 *   is replaced, it is kept as a `DocumentVersion`. **When both sides changed the body** since the last
 *   sync, Ever Works' version becomes the current content and Gauzy's edit is kept as a version
 *   "Gauzy edit (conflict)"; the conflict is logged and the last Gauzy editor gets an Inbox notice
 *   (plan 05 §3). A deleted or private document archives its page (nothing is hard-deleted). A folder
 *   follows renames and moves; a deleted folder is archived (its documents move to Unfiled on their own).
 * - **G → EW**: a PAGE under the synced tree (not private) becomes an Ever Works document of its area
 *   (`POST /kb/documents` with `externalRef`, class `freeform` unless it carries one, path from its
 *   folder chain), then its title, description and body (TipTap → Markdown) are patched with `If-Match`,
 *   a move between library folders is `/move`, an approval in Gauzy's review queue is `/accept`, and a
 *   deleted or archived page is archived in Ever Works (D8). A FOLDER under `Organization/` becomes a
 *   library folder (renamed and moved with it; a Gauzy folder delete is not pushed).
 * - Each side's body is compared with its own last-synced fingerprint, so a construct one side cannot hold
 *   exactly never flaps. Writes run as the attributed person (act-as), else as the key.
 */
@Injectable()
export class EverWorksDocsService implements EverWorksInboundHandler, EverWorksOutboundHandler, EverWorksSyncSweeper, OnModuleInit {
	readonly aggregateTypes = ['kb_document', 'kb_folder'] as const;
	readonly entityTypes = [EverWorksLinkType.DOC, EverWorksLinkType.DOC_FOLDER] as const;
	/** The dirty sweep (plan 03 §C.2 trigger 3): changed pages and folders of the synced tree, and unlinked ones. */
	readonly sweepIntervalMs = 10 * 60_000;
	private readonly logger = new Logger('EverWorksDocs');
	private readonly lastSweep = new Map<string, number>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly store: EverWorksDocsStore,
		private readonly log: EverWorksSyncLogService,
		private readonly conflicts: EverWorksConflictsService,
		private readonly queue: EverWorksOutboundQueue,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly loop: EverWorksSyncLoop,
		/** The Gauzy Inbox (when loaded): the conflict notice to the last Gauzy editor. */
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null
	) {}

	/** Registers itself with the applier (`kb_document`, `kb_folder`), the pusher (`DOC`, `DOC_FOLDER`) and the loop (sweep). */
	onModuleInit(): void {
		this.applier.register(this);
		this.pusher.register(this);
		this.loop.registerSweeper(this);
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId ? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId) : null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.docs)) return { status: 'skipped', message: 'docs are not synced from Ever Works' };
		if (!this.store.available()) return { status: 'deferred', message: 'the Docs plugin is not loaded in this process', retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
		const actorUserId = await gauzyUserOfActor(this.dataSource, this.links, context, envelope.actor);
		try {
			// Gauzy's rows are stamped with the request context's user (`createdByUserId` / `updatedByUserId`).
			return await runInSyncRequestContext(
				syncRequestUser(context, actorUserId),
				() => (envelope.aggregate.type === 'kb_folder' ? this.applyFolderEvent(context, envelope) : this.applyDocumentEvent(context, envelope)),
				() => new EverWorksNoRequestContextError()
			);
		} catch (error) {
			if (error instanceof EverWorksNoRequestContextError) return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
	}

	private async applyDocumentEvent(context: EverWorksMappingContext, envelope: EverWorksEventEnvelope): Promise<EverWorksApplyOutcome> {
		const ewId = envelope.aggregate.id;
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.DOC, ewId);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the document is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion) return { status: 'skipped', message: 'already applied (version)' };
		// A page made PRIVATE in Gauzy (or put in a private folder) no longer syncs either way.
		const hidden = link ? await this.privateReason(context, link.gauzyId as ID, 'page') : null;
		if (link && hidden) {
			await this.links.unlink(link, 'private in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: hidden };
		}
		const data = { ...((envelope.data ?? {}) as unknown as EverWorksKbDocument), id: ewId };
		if (envelope.type === 'kb.document.deleted' || data.deleted) return this.archivePage(context, link, 'deleted in Ever Works; the Gauzy page is archived');
		if (!DOCUMENT_EVENTS.has(envelope.type)) return { status: 'skipped', message: `${envelope.type} is not synced` };
		let document: EverWorksKbDocument = data;
		// An event over the body limit carries no body (CR-7): read the document itself.
		if (document.body == null || document.bodyOmitted || document.title === undefined) {
			const fetched = await this.fetchDocument(context, ewId);
			if (!fetched) return { status: 'skipped', message: 'the document is not visible in Ever Works' };
			document = fetched;
		}
		return this.applyDocument(context, link, document, version ?? document.version ?? null, new Set());
	}

	/**
	 * Writes an Ever Works document into its Gauzy page (creating the page, and its folders, when it is
	 * new). `keep`: fields Gauzy changed after the last sync and is pushing right now (a 412 retry) — Ever
	 * Works' older value is not written over them, and the snapshot moves to Ever Works' value so the
	 * retry pushes Gauzy's.
	 */
	private async applyDocument(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		document: EverWorksKbDocument,
		version: number | null,
		keep: ReadonlySet<KeptField>
	): Promise<EverWorksApplyOutcome> {
		const before = this.links.snapshot<DocSnapshot>(link);
		const archived = isEverWorksArchived(document);
		let page = link ? await this.store.load(context, link.gauzyId as ID, true) : null;
		// The sync's own page of this document (a lost link) is found by its provenance.
		if (!page) page = await this.store.byExternalId(context, document.id);
		if (page && (page as { deletedAt?: Date | null }).deletedAt) return { status: 'skipped', message: 'the Gauzy page was deleted; it is not brought back' };
		if (!page && archived) return { status: 'skipped', message: 'archived in Ever Works; nothing to create' };
		const [resolveWikilink, resolveMention] = await this.resolvers(context, document);
		const { contentJson, contentHtml } = markdownToDocument(document.body ?? '', { resolveWikilink });
		const eHash = markdownHash(document.body ?? '');
		const review = gauzyReviewOf(document);
		const parentId = await this.parentFor(context, document);
		const written = (json: unknown) => markdownHash(documentToMarkdown(json, { resolveMention }));

		if (!page) {
			const fields: DocsPageFields = {
				name: document.title || 'Untitled',
				description: gauzyDescriptionOf(document.description),
				contentJson,
				contentHtml,
				isLocked: !!document.locked,
				...review,
				metadata: mergeMetadata(null, everWorksMetadataOf(document))
			};
			const id = await this.store.createPage(context, parentId, document.id, fields);
			await this.record(context, id, document, version, this.snapshotOf(document, eHash, written(contentJson)), 'inbound');
			this.logger.log(`Ever Works document ${document.id} created as Gauzy page ${id} (organization ${context.organizationId}).`);
			return { status: 'applied' };
		}

		// A page moved out of the synced folders in Gauzy is no longer synced: Ever Works' edits never follow it.
		const root = link ? await this.store.existingRoot(context) : null;
		if (link && (!root || !(await this.store.ancestry(context, page, root)).underRoot)) {
			await this.links.unlink(link, 'moved out of the synced folders in Gauzy; both documents are kept');
			return { status: 'skipped', message: 'the Gauzy page was moved out of the synced folders; it is no longer synced' };
		}
		const fields: Partial<DocsPageFields> = { metadata: mergeMetadata(page.metadata, everWorksMetadataOf(document)) };
		const next: DocSnapshot = { ...before, ewFolderId: document.folderId ?? null, status: document.status, reviewState: document.reviewState, locked: !!document.locked, eHash };
		const gauzyHash = this.gauzyHash(page, resolveMention);
		let message: string | undefined;
		// Body: Ever Works changed it since the last sync.
		if ((before.eHash === undefined || eHash !== before.eHash) && !keep.has('body')) {
			const gauzyChanged = before.gHash !== undefined && gauzyHash !== before.gHash;
			if (gauzyChanged) {
				// Both changed: Ever Works' version wins, Gauzy's edit is kept as a version (plan 05 §3).
				const versionId = await this.store.snapshot(context, page, 'Gauzy edit (conflict)');
				await this.recordBodyConflict(context, page, document, versionId);
				message = 'both sides changed the body: Ever Works wins, the Gauzy edit is kept as a version';
			} else {
				// Every write keeps the page's previous content restorable.
				await this.store.snapshot(context, page);
			}
			fields.contentJson = contentJson;
			fields.contentHtml = contentHtml;
			next.gHash = written(contentJson);
		} else if (before.gHash === undefined) next.gHash = gauzyHash;
		// Title and description: Ever Works' change wins over a Gauzy one not pushed yet (logged), unless Gauzy is pushing it now.
		if (document.title !== undefined && document.title !== before.title) {
			next.title = document.title;
			if (!keep.has('title')) {
				if (before.title !== undefined && page.name !== before.title && page.name !== document.title)
					await this.recordFieldConflict(context, page, document, 'title', page.name, document.title);
				fields.name = document.title || 'Untitled';
			}
		}
		const description = gauzyDescriptionOf(document.description);
		if (description !== (before.description ?? null)) {
			next.description = description;
			if (!keep.has('description')) fields.description = description;
		}
		if (!!document.locked !== before.locked) fields.isLocked = !!document.locked;
		if (document.reviewState !== before.reviewState) Object.assign(fields, review);
		// The folder: only a move in Ever Works moves the page (a Gauzy move inside the tree is pushed instead).
		const moved = (document.folderId ?? null) !== (before.ewFolderId ?? null) && !keep.has('folder');
		if (keep.has('folder')) next.ewFolderId = before.ewFolderId ?? null;
		await this.store.updatePage(context, page.id as ID, fields, moved && page.parentId !== parentId ? parentId : undefined);
		if (archived && !page.isArchived && before.status !== 'archived') await this.store.archive(context, page.id as ID);
		if (!archived && page.isArchived && before.status === 'archived') await this.store.unarchive(context, page.id as ID);
		await this.record(context, page.id as ID, document, version, next, 'inbound');
		return { status: 'applied', ...(message ? { message } : {}) };
	}

	private async applyFolderEvent(context: EverWorksMappingContext, envelope: EverWorksEventEnvelope): Promise<EverWorksApplyOutcome> {
		const ewId = envelope.aggregate.id;
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, ewId);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the folder is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion) return { status: 'skipped', message: 'already applied (version)' };
		// A folder made PRIVATE in Gauzy (or inside a private folder) no longer syncs either way.
		const hidden = link ? await this.privateReason(context, link.gauzyId as ID, 'folder') : null;
		if (link && hidden) {
			await this.links.unlink(link, 'private in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: hidden };
		}
		const data = { ...((envelope.data ?? {}) as unknown as EverWorksKbFolder), id: ewId };
		if (envelope.type === 'kb.folder.deleted' || data.deleted) {
			if (!link) return { status: 'skipped', message: 'the folder is not linked' };
			// Its documents move to Unfiled on their own (`kb.document.moved`); the Gauzy folder is archived, never deleted.
			await this.store.archive(context, link.gauzyId as ID);
			await this.links.unlink(link, 'deleted in Ever Works; the Gauzy folder is archived');
			return { status: 'applied' };
		}
		if (!['kb.folder.created', 'kb.folder.updated'].includes(envelope.type)) return { status: 'skipped', message: `${envelope.type} is not synced` };
		let folder: EverWorksKbFolder = data;
		if (!folder.name) {
			const fetched = await this.fetchFolder(context, ewId);
			if (!fetched) return { status: 'skipped', message: 'the folder is not visible in Ever Works' };
			folder = fetched;
		}
		await this.ensureFolder(context, folder, link, version ?? folder.version ?? null, 0);
		return { status: 'applied' };
	}

	/** The Gauzy folder of an Ever Works library folder: created (with its parents) or renamed / moved to match. */
	private async ensureFolder(context: EverWorksMappingContext, folder: EverWorksKbFolder, link: EverWorksEntityLink | null, version: number | null, depth: number): Promise<ID> {
		const parentId = folder.parentId ? await this.folderFor(context, folder.parentId, depth + 1) : await this.store.organizationFolder(context);
		const before = this.links.snapshot<FolderSnapshot>(link);
		let row = link ? await this.store.load(context, link.gauzyId as ID, true) : null;
		if (!row) row = await this.store.byExternalId(context, DOCS_TREE.folder(folder.id));
		if (row && (row as { deletedAt?: Date | null }).deletedAt) {
			// Deleted in Gauzy: it stays deleted (its provenance is unique, deleted rows included, so it is never
			// created twice) and the pairing ends; its documents land in Organization/.
			await this.links.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				entityType: EverWorksLinkType.DOC_FOLDER,
				gauzyId: row.id as ID,
				ewId: folder.id,
				ewVersion: version ?? folder.version ?? null,
				direction: 'inbound',
				state: EverWorksLinkState.UNLINKED
			});
			return this.store.organizationFolder(context);
		}
		let id: ID;
		if (row) {
			id = row.id as ID;
			await this.store.updateFolder(context, id, {
				...(folder.name !== (before.name ?? row.name) ? { name: folder.name } : {}),
				...((folder.parentId ?? null) !== (before.ewParentId ?? null) || !link ? (row.parentId !== parentId ? { parentId } : {}) : {})
			});
			if (row.isArchived) await this.store.unarchive(context, id);
		} else {
			id = await this.store.createFolder(context, { name: folder.name, parentId, externalId: DOCS_TREE.folder(folder.id) });
		}
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.DOC_FOLDER,
			gauzyId: id,
			ewId: folder.id,
			ewVersion: version ?? folder.version ?? null,
			ewUpdatedAt: folder.updatedAt ?? null,
			snapshot: { name: folder.name, ewParentId: folder.parentId ?? null } satisfies FolderSnapshot as unknown as Record<string, unknown>,
			ewOnly: { path: folder.path, webUrl: folder.webUrl ?? null },
			direction: 'inbound'
		});
		return id;
	}

	/** The Gauzy folder of an Ever Works folder id, fetched and created (with its parents) when not linked yet. */
	private async folderFor(context: EverWorksMappingContext, ewFolderId: string, depth: number): Promise<ID> {
		if (depth > MAX_FOLDER_DEPTH) return this.store.organizationFolder(context);
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, ewFolderId);
		// A folder that is no longer synced (deleted in Gauzy) holds nothing here: its documents go to Organization/.
		if (link?.state === EverWorksLinkState.UNLINKED) return this.store.organizationFolder(context);
		if (link) {
			const row = await this.store.load(context, link.gauzyId as ID);
			if (row && row.kind === DocumentKindEnum.FOLDER) return row.id as ID;
		}
		const folder = await this.fetchFolder(context, ewFolderId);
		if (!folder) return this.store.organizationFolder(context);
		return this.ensureFolder(context, folder, link, folder.version ?? null, depth);
	}

	/** Where an Ever Works document lands: its library folder (or `Organization/`), or its Work's folder. */
	private async parentFor(context: EverWorksMappingContext, document: EverWorksKbDocument): Promise<ID> {
		const workId = document.scope?.type === 'work' ? document.scope.id : document.workId;
		if (workId) return this.workFolderFor(context, workId);
		return document.folderId ? this.folderFor(context, document.folderId, 0) : this.store.organizationFolder(context);
	}

	/** `Works/<Work name>/` of a Work, linked to the Work's paired project. */
	private async workFolderFor(context: EverWorksMappingContext, workId: string): Promise<ID> {
		const existing = await this.store.byExternalId(context, DOCS_TREE.work(workId));
		if (existing && !(existing as { deletedAt?: Date | null }).deletedAt && !existing.isArchived) return existing.id as ID;
		const pair = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, workId);
		let name = `Work ${workId.slice(0, 8)}`;
		try {
			const work = await this.client(context).request<{ name?: string | null }>('GET', `/works/${encodeURIComponent(workId)}`);
			if (work?.name) name = work.name;
		} catch (error) {
			if (!(error instanceof EverWorksApiError && error.status < 500)) throw error;
		}
		return this.store.workFolder(context, workId, name, pair && pair.state !== EverWorksLinkState.UNLINKED ? (pair.gauzyId as ID) : null);
	}

	/** An Ever Works document's removal archives its page (the delete policy) and ends the pairing. */
	private async archivePage(context: EverWorksMappingContext, link: EverWorksEntityLink | null, reason: string): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the document is not linked' };
		const page = await this.store.load(context, link.gauzyId as ID);
		if (page && !page.isArchived) await this.store.archive(context, page.id as ID);
		await this.links.unlink(link, reason);
		return { status: 'applied' };
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id) return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.docs)) return { status: 'skipped', message: 'docs are not pushed to Ever Works' };
		if (!this.store.available()) return { status: 'deferred', message: 'the Docs plugin is not loaded in this process', retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
		try {
			// A push may write Gauzy too (a 412 merge): as the admin who connected.
			return await runInSyncRequestContext(
				syncRequestUser(context, (context.connection.connectedByUserId as ID) ?? null),
				() => (change.entityType === EverWorksLinkType.DOC_FOLDER ? this.pushFolder(context, change) : this.pushDocument(context, change)),
				() => new EverWorksNoRequestContextError()
			);
		} catch (error) {
			if (error instanceof EverWorksNoRequestContextError) return { status: 'deferred', message: error.message, retryInMs: NO_REQUEST_CONTEXT_RETRY_MS };
			throw error;
		}
	}

	private async pushDocument(context: EverWorksMappingContext, change: EverWorksOutboundChange): Promise<EverWorksPushOutcome> {
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.DOC, change.gauzyId as ID);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the document is no longer synced' };
		const page = await this.store.load(context, change.gauzyId as ID, true);
		const client = this.client(context);
		if (change.op === 'delete' || !page || (page as { deletedAt?: Date | null }).deletedAt || page.isArchived) return this.archiveInEverWorks(context, client, link, change);
		if (page.kind !== DocumentKindEnum.PAGE) return { status: 'skipped', message: 'only pages sync as documents' };
		const root = await this.store.existingRoot(context);
		const placement = root ? await this.placementOf(context, page, root) : null;
		// Each case returns on its own: the API image compiles plugins without strictNullChecks, where a
		// `placement && …` guard does not narrow the union (develop's API build broke on that once, #10839).
		if (!placement) {
			if (link) await this.links.unlink(link, 'moved out of the synced folders; both documents are kept');
			return { status: 'skipped', message: 'not in the synced folders' };
		}
		// A PRIVATE folder's name is metadata that must not leak (the Docs plugin's §3.2 rule): nothing under one syncs.
		if ('privateFolder' in placement) {
			if (link) await this.links.unlink(link, 'in a private folder in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: 'pages in a private folder never sync' };
		}
		if ('waitingFor' in placement) return { status: 'deferred', message: `waiting for the folder ${placement.waitingFor} to sync first` };
		if (page.visibility === DocumentVisibilityEnum.PRIVATE) {
			if (link) await this.links.unlink(link, 'private in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: 'private pages never sync' };
		}
		const [, resolveMention] = await this.resolvers(context, null);
		const markdown = this.gauzyMarkdown(page, resolveMention);
		if (!link) return this.createDocument(context, client, page, placement, markdown, change.actorUserId as ID | null);
		// Edits go as the person who made them (else the page's last editor), like the create.
		const actAs = await everWorksUserOfGauzyUser(this.dataSource, this.links, context, (change.actorUserId as ID | null) ?? (page.updatedByUserId as ID | undefined) ?? null);
		return this.updateDocument(context, client, page, placement, markdown, link, actAs);
	}

	private async createDocument(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		page: Document,
		placement: DocsPlacement,
		markdown: string,
		actorUserId: ID | null
	): Promise<EverWorksPushOutcome> {
		const connectionId = context.connection.id as ID;
		const kind = everWorksClassOf(page.metadata);
		const actAs = await everWorksUserOfGauzyUser(this.dataSource, this.links, context, actorUserId ?? (page.createdByUserId as ID | undefined) ?? null);
		const base: Omit<EverWorksKbDocumentCreate, 'path'> = {
			scope: placement.area === 'organization' ? { type: 'organization', id: context.everWorksOrganizationId } : { type: 'work', id: placement.workId },
			...(placement.area === 'organization' && placement.ewFolderId ? { folderId: placement.ewFolderId } : {}),
			title: cut(page.name, KB_LIMITS.title) || 'Untitled',
			class: kind,
			body: cut(markdown, KB_LIMITS.body),
			description: page.description ? cut(page.description, KB_LIMITS.description) : null,
			status: 'active',
			externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: page.id as string }
		};
		let created: EverWorksKbDocument | null = null;
		for (let attempt = 0; attempt < PATH_RETRY_ATTEMPTS && !created; attempt++) {
			const body: EverWorksKbDocumentCreate = { ...base, path: documentPathOf(placement, page.name, kind, attempt ? (page.id as string) : undefined) };
			const key = (who: string) => createHash('sha256').update(`${connectionId}:${EverWorksLinkType.DOC}:${page.id}:create:${who}:${body.path}`).digest('hex');
			try {
				created = await this.asPersonElseKey(actAs, (asUser) =>
					client.request<EverWorksKbDocument>('POST', '/kb/documents', { body, idempotencyKey: key(asUser ? 'user' : 'integration'), actAsUserId: asUser })
				);
			} catch (error) {
				// The path is taken by another document of the scope: once more with a suffix from the Gauzy id.
				if (error instanceof EverWorksApiError && error.status === 409 && attempt + 1 < PATH_RETRY_ATTEMPTS) continue;
				if (error instanceof EverWorksApiError && (error.status === 422 || error.status === 400)) {
					await this.logRefusal(context, 'outbound', EverWorksLinkType.DOC, page.id as ID, null, 'create_refused', error);
					return { status: 'skipped', message: `Ever Works refused the document: ${error.message}` };
				}
				throw error;
			}
		}
		if (!created) return { status: 'skipped', message: 'no free path for the document in Ever Works' };
		// A repeat of the same externalRef answers the existing document: never re-pair one another page holds.
		const holder = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.DOC, created.id);
		if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== page.id) return { status: 'skipped', message: `the Ever Works document ${created.id} is paired with another page` };
		await this.record(context, page.id as ID, created, created.version ?? null, {
			title: page.name,
			description: page.description ?? null,
			eHash: markdownHash(created.body ?? markdown),
			gHash: markdownHash(markdown),
			ewFolderId: created.folderId ?? null,
			status: created.status,
			reviewState: created.reviewState,
			locked: !!created.locked
		}, 'outbound');
		this.logger.log(`Gauzy page ${page.id} created in Ever Works as document ${created.id}.`);
		return { status: 'pushed', message: 'created in Ever Works' };
	}

	private async updateDocument(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		page: Document,
		placement: DocsPlacement,
		markdown: string,
		link: EverWorksEntityLink,
		actAs: string | null
	): Promise<EverWorksPushOutcome> {
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const before = this.links.snapshot<DocSnapshot>(pair);
			const ew = this.ewOnlyOf(pair);
			const ewArea = ew.scope?.type === 'work' || ew.workId ? 'work' : 'organization';
			if (placement.area !== ewArea || (placement.area === 'work' && placement.workId !== (ew.workId ?? ew.scope?.id))) {
				// Ever Works moves a document only between library folders, never between the library and a Work.
				await this.log.write({ ...this.logBase(context), direction: 'outbound', entityType: EverWorksLinkType.DOC, gauzyId: page.id as ID, ewId: pair.ewId, action: 'move_not_synced', status: 'skipped', message: 'The page moved between the organization documents and a Work (or between Works); Ever Works cannot move it there, so it stays where it is in Ever Works.' });
				return { status: 'skipped', message: 'moved across areas: not representable in Ever Works' };
			}
			const gHash = markdownHash(markdown);
			const patch: EverWorksKbDocumentUpdate = {};
			if (page.name !== before.title) patch.title = cut(page.name, KB_LIMITS.title) || 'Untitled';
			if ((page.description ?? null) !== (before.description ?? null)) patch.description = page.description ? cut(page.description, KB_LIMITS.description) : null;
			if (gHash !== before.gHash) patch.body = cut(markdown, KB_LIMITS.body);
			const ewFolderId = placement.area === 'organization' ? placement.ewFolderId : null;
			const move = placement.area === 'organization' && (ewFolderId ?? null) !== (before.ewFolderId ?? null);
			const accept = page.reviewStatus === DocumentReviewStatusEnum.APPROVED && before.reviewState === 'proposed';
			const unarchive = before.status === 'archived';
			if (!Object.keys(patch).length && !move && !accept && !unarchive) return { status: 'skipped', message: 'nothing changed' };
			const id = encodeURIComponent(pair.ewId);
			try {
				let current: EverWorksKbDocument | null = null;
				let ifMatch = pair.ewVersion ?? undefined;
				const write = (method: 'POST' | 'PATCH', path: string, body?: unknown, version?: number) =>
					this.asPersonElseKey(actAs, (asUser) => client.request<EverWorksKbDocument>(method, path, { body, ifMatchVersion: version, actAsUserId: asUser }));
				if (unarchive) {
					current = await write('POST', `/kb/documents/${id}/unarchive`);
					ifMatch = current.version;
				}
				if (Object.keys(patch).length) current = await write('PATCH', `/kb/documents/${id}`, patch, ifMatch);
				if (move) current = await write('POST', `/kb/documents/${id}/move`, { folderId: ewFolderId });
				if (accept) current = await write('POST', `/kb/documents/${id}/accept`);
				const latest = current as EverWorksKbDocument;
				await this.record(context, page.id as ID, latest, latest.version ?? null, {
					title: page.name,
					description: page.description ?? null,
					eHash: latest.body != null ? markdownHash(latest.body) : before.eHash,
					gHash,
					ewFolderId: latest.folderId ?? ewFolderId ?? null,
					status: latest.status,
					reviewState: latest.reviewState,
					locked: !!latest.locked
				}, 'outbound');
				return { status: 'pushed' };
			} catch (error) {
				if (error instanceof EverWorksApiError && error.status === 404) {
					await this.links.unlink(pair, 'gone in Ever Works; the Gauzy page is kept');
					return { status: 'skipped', message: 'the document is gone in Ever Works' };
				}
				if (error instanceof EverWorksApiError && error.status === 422) {
					// A locked document, or a write the person may not make there: Ever Works keeps its version.
					await this.logRefusal(context, 'outbound', EverWorksLinkType.DOC, page.id as ID, pair.ewId, 'update_refused', error);
					return { status: 'skipped', message: `Ever Works refused the edit: ${error.message}` };
				}
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				// 412: Ever Works moved on. Its newer state is applied first (as the sync, so it is not captured
				// back): fields only Gauzy changed are kept for the retry; a body both sides changed goes to Ever
				// Works, with Gauzy's edit kept as a version (plan 05 §3).
				const remote = await this.fetchDocument(context, pair.ewId);
				if (!remote) return { status: 'skipped', message: 'the document is no longer visible in Ever Works' };
				if (!fromEverWorks(context.directions.docs)) {
					// Gauzy is the source (docs `gauzy_to_ew`, review F27): nothing of Ever Works is written into Gauzy.
					// Only its newer version (and body) is recorded on the link, keeping Gauzy's snapshot fields, so the
					// retry sends Gauzy's changes on top of it.
					pair = await this.record(
						context,
						page.id as ID,
						remote,
						remote.version ?? null,
						{ ...before, eHash: remote.body != null ? markdownHash(remote.body) : before.eHash },
						'outbound'
					);
					continue;
				}
				// A field Gauzy changed is kept only while Ever Works still has the last-synced value: when both
				// changed it, Ever Works' version wins (and the conflict is logged), as for a live event.
				const keep = new Set<KeptField>();
				if (patch.title !== undefined && remote.title === before.title) keep.add('title');
				if (patch.description !== undefined && gauzyDescriptionOf(remote.description) === (before.description ?? null)) keep.add('description');
				if (patch.body !== undefined && markdownHash(remote.body ?? '') === before.eHash) keep.add('body');
				if (move) keep.add('folder');
				await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `doc-412:${pair.ewId}` }, () => this.applyDocument(context, pair, remote, remote.version ?? null, keep));
				const fresh = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.DOC, page.id as ID);
				const freshPage = await this.store.load(context, page.id as ID);
				if (!fresh || !freshPage || fresh.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the document changed during the push' };
				pair = fresh;
				page = freshPage;
				const [, resolveMention] = await this.resolvers(context, null);
				markdown = this.gauzyMarkdown(page, resolveMention);
			}
		}
		throw new Error('unreachable');
	}

	/** A removed Gauzy page archives its Ever Works document (D8: nothing is deleted there). */
	private async archiveInEverWorks(context: EverWorksMappingContext, client: EverWorksClient, link: EverWorksEntityLink | null, change: EverWorksOutboundChange): Promise<EverWorksPushOutcome> {
		if (!link) return { status: 'skipped', message: 'not linked' };
		const before = this.links.snapshot<DocSnapshot>(link);
		if (before.status === 'archived') return { status: 'skipped', message: 'already archived in Ever Works' };
		const actAs = await everWorksUserOfGauzyUser(this.dataSource, this.links, context, (change.actorUserId as ID | null) ?? null);
		try {
			const archived = await this.asPersonElseKey(actAs, (asUser) => client.request<EverWorksKbDocument>('POST', `/kb/documents/${encodeURIComponent(link.ewId)}/archive`, { actAsUserId: asUser }));
			await this.links.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				entityType: EverWorksLinkType.DOC,
				gauzyId: link.gauzyId as ID,
				ewId: link.ewId,
				ewVersion: archived.version ?? null,
				ewUpdatedAt: archived.updatedAt ?? null,
				snapshot: { ...before, status: 'archived' } as unknown as Record<string, unknown>,
				direction: 'outbound'
			});
			return { status: 'pushed', message: 'the page was removed in Gauzy; the document is archived in Ever Works' };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) {
				await this.links.unlink(link, 'gone in Ever Works');
				return { status: 'skipped', message: 'the document is gone in Ever Works' };
			}
			throw error;
		}
	}

	private async pushFolder(context: EverWorksMappingContext, change: EverWorksOutboundChange): Promise<EverWorksPushOutcome> {
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, change.gauzyId as ID);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the folder is no longer synced' };
		const folder = await this.store.load(context, change.gauzyId as ID, true);
		if (change.op === 'delete' || !folder || (folder as { deletedAt?: Date | null }).deletedAt || folder.isArchived)
			return { status: 'skipped', message: 'a Gauzy folder delete is not pushed (nothing is deleted in Ever Works)' };
		if (folder.kind !== DocumentKindEnum.FOLDER) return { status: 'skipped', message: 'not a folder' };
		if (folder.externalSource === EVER_WORKS_DOCS_SOURCE && String(folder.externalId ?? '').startsWith('tree:')) return { status: 'skipped', message: 'a folder of the synced tree' };
		// A PRIVATE folder (or one inside a private folder) never syncs: its name must not leak (the Docs plugin's §3.2 rule).
		if (folder.visibility === DocumentVisibilityEnum.PRIVATE) {
			if (link) await this.links.unlink(link, 'private in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: 'private folders never sync' };
		}
		const root = await this.store.existingRoot(context);
		if (!root) return { status: 'skipped', message: 'not in the synced folders' };
		const { folders, underRoot } = await this.store.ancestry(context, folder, root);
		if (folders.some((above) => above.visibility === DocumentVisibilityEnum.PRIVATE) || (await this.isPrivateFolder(context, root))) {
			if (link) await this.links.unlink(link, 'in a private folder in Gauzy; no longer shared with Ever Works');
			return { status: 'skipped', message: 'folders in a private folder never sync' };
		}
		const top = folders[folders.length - 1];
		if (!underRoot || !top || top.externalSource !== EVER_WORKS_DOCS_SOURCE || top.externalId !== DOCS_TREE.organization) {
			if (link) await this.links.unlink(link, 'moved out of the organization documents; both folders are kept');
			return { status: 'skipped', message: 'only folders under Organization/ are library folders' };
		}
		const parent = folders[0] as Document;
		let ewParentId: string | null = null;
		if (parent.id !== top.id) {
			const parentLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, parent.id as ID);
			if (!parentLink || parentLink.state === EverWorksLinkState.UNLINKED) return { status: 'deferred', message: `waiting for the folder ${parent.id} to sync first` };
			ewParentId = parentLink.ewId;
		}
		const client = this.client(context);
		const name = cut(folder.name, KB_LIMITS.folderName) || 'Folder';
		// Folder writes go as the person who made them (an organization admin in Ever Works), else as the key.
		const actAs = await everWorksUserOfGauzyUser(
			this.dataSource,
			this.links,
			context,
			(change.actorUserId as ID | null) ?? (folder.updatedByUserId as ID | undefined) ?? (folder.createdByUserId as ID | undefined) ?? null
		);
		if (!link) {
			let created: EverWorksKbFolder;
			try {
				created = await this.asPersonElseKey(actAs, (asUser) =>
					client.request<EverWorksKbFolder>('POST', '/kb/folders', {
						body: { name, parentId: ewParentId, externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: context.connection.id, externalId: folder.id } },
						idempotencyKey: createHash('sha256')
							.update(`${context.connection.id}:${EverWorksLinkType.DOC_FOLDER}:${folder.id}:create:${asUser ? 'user' : 'integration'}:${ewParentId}:${name}`)
							.digest('hex'),
						actAsUserId: asUser
					})
				);
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 409)) throw error;
				// A sibling of that name exists: the folders are the same folder, paired (unless it is paired already).
				const sibling = await this.siblingNamed(client, ewParentId, name);
				if (!sibling) throw error;
				const holder = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, sibling.id);
				if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== folder.id) return { status: 'skipped', message: `the Ever Works folder ${sibling.id} is paired with another folder` };
				created = sibling;
			}
			await this.recordFolder(context, folder.id as ID, created, folder.name, 'outbound');
			return { status: 'pushed', message: 'created in Ever Works' };
		}
		const before = this.links.snapshot<FolderSnapshot>(link);
		const patch: { name?: string; parentId?: string | null } = {};
		if (folder.name !== before.name) patch.name = name;
		if (ewParentId !== (before.ewParentId ?? null)) patch.parentId = ewParentId;
		if (!Object.keys(patch).length) return { status: 'skipped', message: 'nothing changed' };
		try {
			const updated = await this.asPersonElseKey(actAs, (asUser) =>
				client.request<EverWorksKbFolder>('PATCH', `/kb/folders/${encodeURIComponent(link.ewId)}`, { body: patch, ifMatchVersion: link.ewVersion ?? undefined, actAsUserId: asUser })
			);
			await this.recordFolder(context, folder.id as ID, updated, folder.name, 'outbound');
			return { status: 'pushed' };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 412) {
				const remote = await this.fetchFolder(context, link.ewId);
				if (remote && !fromEverWorks(context.directions.docs)) {
					// Gauzy is the source (docs `gauzy_to_ew`, review F27): its rename or move goes again on top of Ever
					// Works' newer version; Ever Works' folder state is not written into Gauzy.
					try {
						const retried = await this.asPersonElseKey(actAs, (asUser) =>
							client.request<EverWorksKbFolder>('PATCH', `/kb/folders/${encodeURIComponent(link.ewId)}`, { body: patch, ifMatchVersion: remote.version ?? undefined, actAsUserId: asUser })
						);
						await this.recordFolder(context, folder.id as ID, retried, folder.name, 'outbound');
						return { status: 'pushed' };
					} catch (retryError) {
						if (retryError instanceof EverWorksApiError && retryError.status === 412) return { status: 'deferred', message: 'Ever Works changed the folder again; the Gauzy change is retried', retryInMs: 60_000 };
						throw retryError;
					}
				}
				// Ever Works changed the folder meanwhile: its rename or move wins (as for document fields).
				if (remote) await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `folder-412:${link.ewId}` }, () => this.ensureFolder(context, remote, link, remote.version ?? null, 0));
				return { status: 'skipped', message: 'Ever Works changed the folder meanwhile; its version is kept' };
			}
			if (error instanceof EverWorksApiError && (error.status === 409 || error.status === 422)) {
				await this.logRefusal(context, 'outbound', EverWorksLinkType.DOC_FOLDER, folder.id as ID, link.ewId, 'update_refused', error);
				return { status: 'skipped', message: `Ever Works refused the folder change: ${error.message}` };
			}
			if (error instanceof EverWorksApiError && error.status === 404) {
				await this.links.unlink(link, 'gone in Ever Works');
				return { status: 'skipped', message: 'the folder is gone in Ever Works' };
			}
			throw error;
		}
	}

	// ── Sweep (plan 03 §C.2 trigger 3) ───────────────────────────────────────────────────────────────

	/**
	 * Every 10 minutes per mapping: the pages and folders of the synced tree changed since the last sweep
	 * (two minutes of overlap) are queued, and on a process's first sweep every node of the tree, so pages
	 * created in Gauzy before the sync (or missed by the entity subscriber) are exported too. A push that
	 * finds nothing changed is a no-op.
	 */
	async sweep(connection: EverWorksConnection, stillOwner?: () => Promise<boolean>): Promise<void> {
		if (!this.store.available()) return;
		for (const context of await this.contexts.forConnection(connection)) {
			if (!context.isEnabled || !toEverWorks(context.directions.docs)) continue;
			const root = await this.store.existingRoot(context);
			if (!root) continue;
			const last = this.lastSweep.get(context.integrationTenantId);
			this.lastSweep.set(context.integrationTenantId, Date.now());
			const folderIds = await this.store.treeFolderIds(context, root);
			const nodes: Array<{ id?: unknown; kind?: DocumentKindEnum }> = await this.store.nodesUnder(context, folderIds, last ? new Date(last - 2 * 60_000) : undefined);
			// Pairs whose Gauzy node left the tree (a move the subscriber did not see, or a delete): their push ends
			// the pairing (a page) or skips it (a folder).
			const inTree = new Set<string>(folderIds as string[]);
			for (const type of [EverWorksLinkType.DOC, EverWorksLinkType.DOC_FOLDER]) {
				const pairs = (await this.links.list(context.integrationTenantId, type)).filter((pair) => pair.state !== EverWorksLinkState.UNLINKED);
				const parents = await this.store.parentsOf(context, pairs.map((pair) => pair.gauzyId as ID));
				for (const pair of pairs) {
					const parent = parents.get(pair.gauzyId as string);
					if (!parent || !inTree.has(parent)) nodes.push({ id: pair.gauzyId, kind: type === EverWorksLinkType.DOC ? DocumentKindEnum.PAGE : DocumentKindEnum.FOLDER });
				}
			}
			for (const [index, node] of nodes.entries()) {
				if (index % 50 === 0 && stillOwner && !(await stillOwner())) return;
				await this.queue.enqueue({
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					entityType: node.kind === DocumentKindEnum.FOLDER ? EverWorksLinkType.DOC_FOLDER : EverWorksLinkType.DOC,
					gauzyId: node.id as ID,
					op: 'upsert'
				});
			}
		}
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	/**
	 * Where a Gauzy page sits in the synced tree: `Organization/…` (with the nearest linked library folder),
	 * `Works/<Work>/…`, `null` outside the tree, `waitingFor` a folder of its chain that is not linked yet
	 * (so it lands in the right Ever Works folder), or `privateFolder` when a folder of its chain is PRIVATE.
	 */
	private async placementOf(
		context: EverWorksMappingContext,
		page: Document,
		rootId: ID
	): Promise<DocsPlacement | { waitingFor: ID } | { privateFolder: ID } | null> {
		const { folders, underRoot } = await this.store.ancestry(context, page, rootId);
		if (!underRoot || !folders.length) return null;
		const hidden = folders.find((folder) => folder.visibility === DocumentVisibilityEnum.PRIVATE);
		if (hidden) return { privateFolder: hidden.id as ID };
		// The synced root itself (ancestry stops below it) may be PRIVATE too.
		if (await this.isPrivateFolder(context, rootId)) return { privateFolder: rootId };
		const chain = [...folders].reverse(); // from the root's child down to the page's parent
		const top = chain[0] as Document;
		if (top.externalSource !== EVER_WORKS_DOCS_SOURCE) return null;
		if (top.externalId === DOCS_TREE.organization) {
			const below = chain.slice(1);
			let ewFolderId: string | null = null;
			const nearest = below[below.length - 1];
			if (nearest) {
				const folderLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.DOC_FOLDER, nearest.id as ID);
				if (!folderLink || folderLink.state === EverWorksLinkState.UNLINKED) return { waitingFor: nearest.id as ID };
				ewFolderId = folderLink.ewId;
			}
			return { area: 'organization', ewFolderId, segments: below.map((folder) => folder.name) };
		}
		if (top.externalId === DOCS_TREE.works) {
			const workFolder = chain[1];
			const marker = String(workFolder?.externalSource === EVER_WORKS_DOCS_SOURCE ? (workFolder?.externalId ?? '') : '');
			if (!marker.startsWith('tree:work:')) return null;
			return { area: 'work', workId: marker.slice('tree:work:'.length), segments: chain.slice(2).map((folder) => folder.name) };
		}
		return null;
	}

	/** Why a synced Gauzy page or folder stopped syncing because it, or a folder above it, is PRIVATE; `null` when not. */
	private async privateReason(context: EverWorksMappingContext, nodeId: ID, kind: 'page' | 'folder'): Promise<string | null> {
		const node = await this.store.load(context, nodeId, true);
		if (!node) return null;
		if (node.visibility === DocumentVisibilityEnum.PRIVATE) return kind === 'page' ? 'private pages never sync' : 'private folders never sync';
		const root = await this.store.existingRoot(context);
		if (!root || node.id === root) return null;
		const { folders } = await this.store.ancestry(context, node, root);
		if (!folders.some((folder) => folder.visibility === DocumentVisibilityEnum.PRIVATE) && !(await this.isPrivateFolder(context, root))) return null;
		return kind === 'page' ? 'pages in a private folder never sync' : 'folders in a private folder never sync';
	}

	/** Whether a Gauzy folder is PRIVATE (the synced root, which `ancestry` does not return). */
	private async isPrivateFolder(context: EverWorksMappingContext, folderId: ID): Promise<boolean> {
		return (await this.store.load(context, folderId))?.visibility === DocumentVisibilityEnum.PRIVATE;
	}

	/**
	 * The two wikilink maps of a mapping: Ever Works path → the synced Gauzy page (for EW → G), and Gauzy
	 * page → Ever Works path (for G → EW). Built from the links (their path and title at the last sync).
	 */
	private async resolvers(
		context: EverWorksMappingContext,
		document: EverWorksKbDocument | null
	): Promise<[(path: string) => { documentId: string; label: string } | null, (documentId: string) => string | null]> {
		const byPath = new Map<string, { documentId: string; label: string }>();
		const byPage = new Map<string, string>();
		for (const link of await this.links.list(context.integrationTenantId, EverWorksLinkType.DOC)) {
			if (link.state === EverWorksLinkState.UNLINKED) continue;
			const ew = this.ewOnlyOf(link);
			if (!ew.path) continue;
			byPage.set(link.gauzyId as string, ew.path);
			// A wikilink is resolved within the document's own scope (the organization library, or its Work).
			const scopeId = ew.scope?.id ?? null;
			if (document && scopeId && document.scope?.id && scopeId !== document.scope.id) continue;
			byPath.set(ew.path, { documentId: link.gauzyId as string, label: this.links.snapshot<DocSnapshot>(link).title ?? ew.path });
		}
		return [(path) => byPath.get(path) ?? byPath.get(`${path}.md`) ?? null, (documentId) => byPage.get(documentId) ?? null];
	}

	/** A Gauzy page as Ever Works Markdown (its TipTap content; the HTML cache when it has none). */
	private gauzyMarkdown(page: Document, resolveMention: (documentId: string) => string | null): string {
		return documentToMarkdown(page.contentJson ?? null, { resolveMention }) || htmlToMarkdown(page.contentHtml ?? '');
	}

	private gauzyHash(page: Document, resolveMention: (documentId: string) => string | null): string {
		return markdownHash(this.gauzyMarkdown(page, resolveMention));
	}

	private snapshotOf(document: EverWorksKbDocument, eHash: string, gHash: string): DocSnapshot {
		return {
			title: document.title,
			description: gauzyDescriptionOf(document.description),
			eHash,
			gHash,
			ewFolderId: document.folderId ?? null,
			status: document.status,
			reviewState: document.reviewState,
			locked: !!document.locked
		};
	}

	private async record(context: EverWorksMappingContext, pageId: ID, document: EverWorksKbDocument, version: number | null, snapshot: DocSnapshot, direction: 'inbound' | 'outbound'): Promise<EverWorksEntityLink> {
		const ewOnly: DocEverWorksOnly = {
			scope: document.scope,
			workId: document.workId ?? null,
			path: document.path,
			slug: document.slug,
			class: document.class,
			lockMode: document.lockMode ?? null,
			revision: document.revision,
			language: document.language,
			source: document.source,
			webUrl: document.webUrl ?? null
		};
		return this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.DOC,
			gauzyId: pageId,
			ewId: document.id,
			ewVersion: version ?? document.version ?? null,
			ewUpdatedAt: document.updatedAt ?? null,
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private async recordFolder(context: EverWorksMappingContext, gauzyId: ID, folder: EverWorksKbFolder, gauzyName: string, direction: 'inbound' | 'outbound'): Promise<void> {
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.DOC_FOLDER,
			gauzyId,
			ewId: folder.id,
			ewVersion: folder.version ?? null,
			ewUpdatedAt: folder.updatedAt ?? null,
			// The Gauzy name (it may be longer than Ever Works keeps), so an unchanged folder is not pushed again.
			snapshot: { name: gauzyName, ewParentId: folder.parentId ?? null } satisfies FolderSnapshot as unknown as Record<string, unknown>,
			ewOnly: { path: folder.path, webUrl: folder.webUrl ?? null },
			direction
		});
	}

	private ewOnlyOf(link: EverWorksEntityLink | null | undefined): DocEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as DocEverWorksOnly;
		} catch {
			return {};
		}
	}

	/** A body both sides changed: logged as a conflict (Ever Works won) and noticed to the last Gauzy editor. */
	private async recordBodyConflict(context: EverWorksMappingContext, page: Document, document: EverWorksKbDocument, versionId: ID | null): Promise<void> {
		await this.conflicts
			.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'inbound',
				entityType: EverWorksLinkType.DOC,
				gauzyId: page.id as ID,
				ewId: document.id,
				field: 'body',
				gauzyValue: { versionId, label: 'Gauzy edit (conflict)' },
				everWorksValue: { revision: document.revision, revisionAt: document.revisionAt },
				winner: 'ever_works',
				gauzyAt: page.updatedAt ? new Date(page.updatedAt).toISOString() : null,
				everWorksAt: document.revisionAt ?? document.updatedAt ?? null,
				message: `Both Gauzy and Ever Works changed "${cut(page.name, 120)}". Ever Works' version is the current content; the Gauzy edit is kept in the page's history as "Gauzy edit (conflict)".`
			})
			.catch((error) => this.logger.warn(`Page ${page.id}: the conflict could not be logged (${error instanceof Error ? error.name : 'error'}).`));
		await this.noticeConflict(context, page, versionId);
	}

	private async recordFieldConflict(context: EverWorksMappingContext, page: Document, document: EverWorksKbDocument, field: 'title', gauzyValue: string, everWorksValue: string): Promise<void> {
		await this.conflicts
			.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				connectionId: context.connection.id as ID,
				direction: 'inbound',
				entityType: EverWorksLinkType.DOC,
				gauzyId: page.id as ID,
				ewId: document.id,
				field,
				gauzyField: field === 'title' ? 'name' : field,
				gauzyValue,
				everWorksValue,
				winner: 'ever_works',
				gauzyAt: page.updatedAt ? new Date(page.updatedAt).toISOString() : null,
				everWorksAt: document.updatedAt ?? null
			})
			.catch((error) => this.logger.warn(`Page ${page.id}: the conflict could not be logged (${error instanceof Error ? error.name : 'error'}).`));
	}

	/** The Inbox notice of a body conflict to the page's last Gauzy editor (when the Inbox is loaded). */
	private async noticeConflict(context: EverWorksMappingContext, page: Document, versionId: ID | null): Promise<void> {
		const userId = (page.updatedByUserId ?? page.createdByUserId) as ID | undefined;
		if (!this.inbox || !userId) return;
		try {
			await this.inbox.upsertExternal({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				kind: InboxItemKindEnum.NOTICE,
				source: InboxItemSourceEnum.SYSTEM,
				externalSource: DOCS_NOTICE_SOURCE,
				externalId: `${page.id}:conflict`,
				title: cut(`Ever Works replaced your edit of "${page.name}"`, 200),
				body: 'Both you and Ever Works changed this page since the last sync. Ever Works\' version is now the current content; your edit is kept in the page\'s version history as "Gauzy edit (conflict)", and you can restore it from there.',
				priority: InboxItemPriorityEnum.NORMAL,
				entity: BaseEntityEnum.Document,
				entityId: page.id as ID,
				metadata: { integration: 'ever_works', documentId: page.id, versionId },
				recipients: [{ userId, isRead: false, isArchived: false }]
			});
		} catch (error) {
			this.logger.warn(`Page ${page.id}: the conflict notice was not delivered (${error instanceof Error ? error.name : 'error'}).`);
		}
	}

	private async logRefusal(context: EverWorksMappingContext, direction: 'inbound' | 'outbound', entityType: EverWorksLinkType, gauzyId: ID, ewId: string | null, action: string, error: EverWorksApiError): Promise<void> {
		await this.log.write({ ...this.logBase(context), direction, entityType, gauzyId, ewId, action, status: 'conflict', message: `Ever Works refused it (${error.status} ${error.code}): ${error.message}`.slice(0, 2000) });
	}

	private logBase(context: EverWorksMappingContext) {
		return { tenantId: context.tenantId, organizationId: context.organizationId, integrationTenantId: context.integrationTenantId, connectionId: context.connection.id as ID };
	}

	/** A write as the person (`X-Act-As-User`), else as the key: Ever Works may refuse the person (403 act-as, 422 rights). */
	private async asPersonElseKey<T>(actAs: string | null, write: (asUser: string | null) => Promise<T>): Promise<T> {
		try {
			return await write(actAs);
		} catch (error) {
			const refused = error instanceof EverWorksApiError && ((error.status === 403 && error.code === 'act_as_forbidden') || error.status === 422);
			if (!actAs || !refused) throw error;
			return write(null);
		}
	}

	private async fetchDocument(context: EverWorksMappingContext, ewId: string): Promise<EverWorksKbDocument | null> {
		try {
			return { ...(await this.client(context).request<EverWorksKbDocument>('GET', `/kb/documents/${encodeURIComponent(ewId)}`)), id: ewId };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) return null;
			throw error;
		}
	}

	private async fetchFolder(context: EverWorksMappingContext, ewId: string): Promise<EverWorksKbFolder | null> {
		try {
			return { ...(await this.client(context).request<EverWorksKbFolder>('GET', `/kb/folders/${encodeURIComponent(ewId)}`)), id: ewId };
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) return null;
			throw error;
		}
	}

	/** The library folder of a parent with a name (case-insensitive), read through the folder list. */
	private async siblingNamed(client: EverWorksClient, parentId: string | null, name: string): Promise<EverWorksKbFolder | null> {
		let cursor: string | null = null;
		for (let page = 0; page < 50; page++) {
			const result: EverWorksListPage<EverWorksKbFolder> = await client.request<EverWorksListPage<EverWorksKbFolder>>('GET', '/kb/folders', { query: { limit: 500, ...(cursor ? { cursor } : {}) } });
			const found = result.data.find((folder) => (folder.parentId ?? null) === parentId && folder.name.toLowerCase() === name.toLowerCase());
			if (found) return found;
			if (!result.hasMore || !result.nextCursor) return null;
			cursor = result.nextCursor;
		}
		return null;
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}
