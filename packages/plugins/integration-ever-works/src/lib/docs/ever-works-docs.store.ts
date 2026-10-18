// cspell:ignore wikilink wikilinks unfiled
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID
} from '@gauzy/contracts';
import { IntegrationSetting } from '@gauzy/core';
import { Document, DocumentLink, DocumentVersion } from '@gauzy/plugin-docs';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import type { EverWorksMappingContext } from '../mapping/ever-works-mapping-context.service';
import {
	cut,
	DOCS_TREE,
	EVER_WORKS_DOCS_ORGANIZATION_NAME,
	EVER_WORKS_DOCS_ROOT_NAME,
	EVER_WORKS_DOCS_SOURCE,
	EVER_WORKS_DOCS_WORKS_NAME
} from './ever-works-docs.mapper';
import type { TiptapNode } from './ever-works-docs-content';

/** How deep the sync follows a folder chain (a cycle or a pathological tree stops here). */
export const MAX_FOLDER_DEPTH = 64;

/** Sync writes to a page within this window share one restorable snapshot (the Docs editor's default window). */
export const SNAPSHOT_WINDOW_MS = 10 * 60_000;

/** A synced page's fields as the sync writes them. */
export interface DocsPageFields {
	name: string;
	description: string | null;
	contentJson: TiptapNode;
	contentHtml: string;
	isLocked: boolean;
	reviewStatus: DocumentReviewStatusEnum;
	reviewReason: DocumentReviewReasonEnum | null;
	metadata: Record<string, unknown>;
}

/** Where a node of the synced tree sits: its chain of folders from the root's child down to its parent. */
export interface DocsAncestry {
	/** The folders above the node, nearest first (the root itself excluded). */
	folders: Document[];
	/** Whether the chain reaches the root folder. */
	underRoot: boolean;
}

/**
 * The Gauzy side of the docs sync: the Docs plugin's `document`, `document_version` and `document_link`
 * rows, written through the repositories with the tenant and organization stated on every row (the
 * caller runs inside a request context of the attributed user, so `createdByUserId` / `updatedByUserId`
 * are right). The Docs plugin's own services are request-scoped to the signed-in user's permissions, and
 * its create path refuses `source = INTEGRATION`, so they are not used here: these rows are the
 * integration's import (plan 05 §2, research 06 §4.1 "importer seam").
 */
@Injectable()
export class EverWorksDocsStore {
	constructor(private readonly dataSource: DataSource) {}

	/** Whether the Docs plugin's tables are part of this process's ORM (the plugin is loaded wherever the API runs). */
	available(): boolean {
		try {
			return this.dataSource.hasMetadata(Document) && this.dataSource.hasMetadata(DocumentVersion);
		} catch {
			return false;
		}
	}

	/** A document of the mapping's organization (deleted ones too, when asked). */
	async load(context: EverWorksMappingContext, id: ID, withDeleted = false): Promise<Document | null> {
		return this.dataSource.getRepository(Document).findOne({
			where: { id, tenantId: context.tenantId, organizationId: context.organizationId } as never,
			withDeleted
		});
	}

	/** The document the sync wrote for an Ever Works record (its `externalId`), if any. */
	async byExternalId(context: EverWorksMappingContext, externalId: string): Promise<Document | null> {
		return this.dataSource.getRepository(Document).findOne({
			where: {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				externalSource: EVER_WORKS_DOCS_SOURCE,
				externalId
			} as never,
			withDeleted: true
		});
	}

	/** The folders above a node, nearest first, up to (not including) `rootId`. */
	async ancestry(context: EverWorksMappingContext, node: Pick<Document, 'parentId'>, rootId: ID): Promise<DocsAncestry> {
		const folders: Document[] = [];
		const seen = new Set<string>();
		let parentId = node.parentId ?? null;
		while (parentId && folders.length < MAX_FOLDER_DEPTH) {
			if (parentId === rootId) return { folders, underRoot: true };
			if (seen.has(parentId)) break;
			seen.add(parentId);
			const parent = await this.load(context, parentId as ID);
			// An archived folder still holds its nodes (an Ever Works folder delete archives it while its documents move).
			if (!parent || parent.kind !== DocumentKindEnum.FOLDER) break;
			folders.push(parent);
			parentId = parent.parentId ?? null;
		}
		return { folders, underRoot: false };
	}

	/** Every folder id under `rootId` (the root included), breadth first, for the sweep. */
	async treeFolderIds(context: EverWorksMappingContext, rootId: ID, max = 10_000): Promise<ID[]> {
		const ids: ID[] = [rootId];
		const seen = new Set<string>(ids);
		const repository = this.dataSource.getRepository(Document);
		for (let index = 0; index < ids.length && ids.length < max; index++) {
			const children = await repository.find({
				where: { tenantId: context.tenantId, organizationId: context.organizationId, parentId: ids[index], kind: DocumentKindEnum.FOLDER } as never,
				select: { id: true } as never
			});
			for (const child of children) {
				if (seen.has(child.id as string)) continue;
				seen.add(child.id as string);
				ids.push(child.id as ID);
			}
		}
		return ids;
	}

	/** The parent of each of the given nodes (`null` for a deleted one); a node that is gone is missing from the map. */
	async parentsOf(context: EverWorksMappingContext, ids: ID[]): Promise<Map<string, string | null>> {
		const out = new Map<string, string | null>();
		for (let index = 0; index < ids.length; index += 200) {
			const rows = await this.dataSource
				.getRepository(Document)
				.createQueryBuilder('document')
				.withDeleted()
				.select(['document.id', 'document.parentId', 'document.deletedAt'])
				.where('document.tenantId = :tenantId', { tenantId: context.tenantId })
				.andWhere('document.organizationId = :organizationId', { organizationId: context.organizationId })
				.andWhere('document.id IN (:...ids)', { ids: ids.slice(index, index + 200) })
				.getMany();
			for (const row of rows) out.set(row.id as string, (row as { deletedAt?: Date | null }).deletedAt ? null : (row.parentId ?? null));
		}
		return out;
	}

	/** Each given node's parent (`null` at the top) and whether it is deleted; a node that is gone is missing from the map. */
	async nodeStatesOf(context: EverWorksMappingContext, ids: ID[]): Promise<Map<string, { parentId: string | null; deleted: boolean }>> {
		const out = new Map<string, { parentId: string | null; deleted: boolean }>();
		for (let index = 0; index < ids.length; index += 200) {
			const rows = await this.dataSource
				.getRepository(Document)
				.createQueryBuilder('document')
				.withDeleted()
				.select(['document.id', 'document.parentId', 'document.deletedAt'])
				.where('document.tenantId = :tenantId', { tenantId: context.tenantId })
				.andWhere('document.organizationId = :organizationId', { organizationId: context.organizationId })
				.andWhere('document.id IN (:...ids)', { ids: ids.slice(index, index + 200) })
				.getMany();
			for (const row of rows) out.set(row.id as string, { parentId: row.parentId ?? null, deleted: !!(row as { deletedAt?: Date | null }).deletedAt });
		}
		return out;
	}

	/** The PAGE and FOLDER nodes directly under the given folders (deleted and archived ones included). */
	async nodesUnder(
		context: EverWorksMappingContext,
		folderIds: ID[],
		updatedAfter?: Date
	): Promise<Array<Pick<Document, 'id' | 'kind' | 'updatedAt'> & { deletedAt?: Date | null }>> {
		const out: Array<Pick<Document, 'id' | 'kind' | 'updatedAt'> & { deletedAt?: Date | null }> = [];
		for (let index = 0; index < folderIds.length; index += 200) {
			const qb = this.dataSource
				.getRepository(Document)
				.createQueryBuilder('document')
				.withDeleted()
				.select(['document.id', 'document.kind', 'document.updatedAt', 'document.deletedAt'])
				.where('document.tenantId = :tenantId', { tenantId: context.tenantId })
				.andWhere('document.organizationId = :organizationId', { organizationId: context.organizationId })
				.andWhere('document.parentId IN (:...parents)', { parents: folderIds.slice(index, index + 200) })
				.andWhere('document.kind IN (:...kinds)', { kinds: [DocumentKindEnum.PAGE, DocumentKindEnum.FOLDER] });
			if (updatedAfter) qb.andWhere('document.updatedAt > :after', { after: updatedAfter });
			out.push(...(await qb.getMany()));
		}
		return out;
	}

	// ── The tree (plan 05 §1) ─────────────────────────────────────────────────────────────────────

	/**
	 * The root folder synced documents land in: the configured one (`DOCS_ROOT_FOLDER_ID`) while it is a folder of the
	 * organization, archived or not (an archived folder still holds its pages, OQ5), else the sync's own "Ever Works"
	 * folder, created at the top of the organization's Docs when first needed (and saved as the setting). The synced
	 * tree is moved under it first when the root changed (`placeTree`).
	 */
	async root(context: EverWorksMappingContext): Promise<ID> {
		const configured = this.setting(context, EverWorksSettingName.DOCS_ROOT_FOLDER_ID);
		const usable = configured ? await this.usableRoot(context, configured as ID) : null;
		if (usable) {
			await this.placeTree(context, usable);
			return usable;
		}
		const id = await this.ownRoot(context, true);
		if (id !== configured) await this.saveSetting(context, EverWorksSettingName.DOCS_ROOT_FOLDER_ID, id);
		await this.placeTree(context, id);
		return id;
	}

	/**
	 * The root folder when it exists already (a push never creates the tree), else `null`; the tree follows it as in
	 * `root`. A configured root that cannot hold the tree any more (deleted) while the tree exists gives way to the
	 * sync's own folder here too, so the sweep finds the tree again without waiting for an Ever Works event.
	 */
	async existingRoot(context: EverWorksMappingContext): Promise<ID | null> {
		const configured = this.setting(context, EverWorksSettingName.DOCS_ROOT_FOLDER_ID);
		const usable = configured ? await this.usableRoot(context, configured as ID) : null;
		if (usable) {
			await this.placeTree(context, usable);
			return usable;
		}
		if (configured && (await this.treeFolders(context)).length) return this.root(context);
		const own = await this.ownRoot(context, false);
		if (own) await this.placeTree(context, own);
		return own;
	}

	/**
	 * A configured root that can hold the tree: a live (not deleted) folder of the organization, archived ones included,
	 * that is not itself part of the synced tree (a root inside `Organization/` or `Works/` would put the tree under
	 * itself).
	 */
	private async usableRoot(context: EverWorksMappingContext, id: ID): Promise<ID | null> {
		const folder = await this.load(context, id);
		if (!folder || folder.kind !== DocumentKindEnum.FOLDER) return null;
		// The root the tree was placed under was checked when it was placed.
		if (id === this.setting(context, EverWorksSettingName.DOCS_TREE_ROOT_ID) && !this.setting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO)) {
			return id;
		}
		return (await this.insideTree(context, folder)) ? null : (folder.id as ID);
	}

	/**
	 * The sync's own "Ever Works" folder: used as it is while it is a live folder (archived ones too, like a configured
	 * root), else revived from deleted or created when `create` is set. A folder that lies inside the synced tree (an
	 * admin dragged it there) goes back to the top first, so the tree never ends up under itself.
	 */
	private async ownRoot(context: EverWorksMappingContext, create: true): Promise<ID>;
	private async ownRoot(context: EverWorksMappingContext, create: false): Promise<ID | null>;
	private async ownRoot(context: EverWorksMappingContext, create: boolean): Promise<ID | null> {
		const own = await this.byExternalId(context, DOCS_TREE.root);
		const live = !!own && !(own as { deletedAt?: Date | null }).deletedAt && own.kind === DocumentKindEnum.FOLDER;
		if (!live && !create) return null;
		const id = own && live ? (own.id as ID) : await this.treeFolder(context, DOCS_TREE.root, null, EVER_WORKS_DOCS_ROOT_NAME);
		const folder = own && live ? own : await this.load(context, id);
		if (folder?.parentId && (await this.insideTree(context, folder))) {
			await this.dataSource
				.getRepository(Document)
				.update({ id, tenantId: context.tenantId } as never, { parentId: null, index: await this.nextIndex(context, null) } as never);
		}
		return id;
	}

	/** Whether a folder is one of the tree folders (`Organization/`, `Works/`) or lies inside one of them. */
	private async insideTree(context: EverWorksMappingContext, folder: Document): Promise<boolean> {
		const tree = new Set((await this.treeFolders(context)).map((node) => node.id as string));
		if (tree.has(folder.id as string)) return true;
		const { folders } = await this.ancestry(context, folder, '' as ID);
		return folders.some((above) => tree.has(above.id as string));
	}

	/** The tree folders the sync keeps (`Organization/`, `Works/`) that exist and are not deleted. */
	private async treeFolders(context: EverWorksMappingContext): Promise<Document[]> {
		const folders: Document[] = [];
		for (const marker of [DOCS_TREE.organization, DOCS_TREE.works]) {
			const folder = await this.byExternalId(context, marker);
			if (folder && !(folder as { deletedAt?: Date | null }).deletedAt) folders.push(folder);
		}
		return folders;
	}

	/**
	 * Keeps the synced tree under the current root (OQ5). When the root changed (an admin set another
	 * `docsRootFolderId`, or the configured one was deleted), the `Organization/` and `Works/` folders move from the
	 * root they were placed under (`DOCS_TREE_ROOT_ID`) to the new one, with everything in them, so every link and
	 * page keeps syncing.
	 *
	 * - **Safe to stop part-way, idempotent.** The target is written first (`DOCS_TREE_MOVING_TO`), each folder moves in
	 *   one write, and the new root is recorded (and the target cleared) only after both moved. The next pass moves
	 *   what still sits under the recorded root or under an unfinished target, so a root changed again (or set back)
	 *   before a move finished still gathers the whole tree. A folder under the new root already is left.
	 * - **An admin's own move stays.** Only a folder directly under the recorded root (or the unfinished target) moves;
	 *   a tree folder an admin put somewhere else is left there, and what is in it stops syncing, as before.
	 * - **A mapping placed before this setting existed** has no recorded root. The only earlier root the sync can be
	 *   sure of is its own "Ever Works" folder: a tree folder directly under it moves; one anywhere else stays. The
	 *   current root is recorded once a tree folder sits under it (or there is no tree yet); otherwise nothing is
	 *   recorded and nothing moves.
	 */
	private async placeTree(context: EverWorksMappingContext, rootId: ID): Promise<void> {
		const recorded = this.setting(context, EverWorksSettingName.DOCS_TREE_ROOT_ID);
		const movingTo = this.setting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO);
		if (recorded === rootId && (!movingTo || movingTo === rootId)) {
			if (movingTo) await this.saveSetting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO, '');
			return;
		}
		const folders = await this.treeFolders(context);
		const sources = new Set<string>();
		if (recorded) {
			sources.add(recorded);
			if (movingTo) sources.add(movingTo);
		} else {
			const own = await this.byExternalId(context, DOCS_TREE.root);
			if (own && !(own as { deletedAt?: Date | null }).deletedAt) sources.add(own.id as string);
		}
		sources.delete(rootId);
		const moving = folders.filter((folder) => folder.parentId && sources.has(folder.parentId));
		if (moving.length) {
			await this.saveSetting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO, rootId);
			for (const folder of moving) {
				await this.dataSource
					.getRepository(Document)
					.update({ id: folder.id, tenantId: context.tenantId } as never, { parentId: rootId, index: await this.nextIndex(context, rootId) } as never);
				folder.parentId = rootId;
			}
		}
		// Without a recorded root, only a tree that (partly) sits under the current root, or no tree yet, records it.
		if (!recorded && folders.length && !folders.some((folder) => folder.parentId === rootId)) return;
		await this.saveSetting(context, EverWorksSettingName.DOCS_TREE_ROOT_ID, rootId);
		if (this.setting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO)) await this.saveSetting(context, EverWorksSettingName.DOCS_TREE_MOVING_TO, '');
	}

	private setting(context: EverWorksMappingContext, name: EverWorksSettingName): string {
		return context.mapping.settings?.find((row) => row.settingsName === name)?.settingsValue ?? '';
	}

	/** `Ever Works/Organization/`: organization documents and the library folder tree. */
	async organizationFolder(context: EverWorksMappingContext): Promise<ID> {
		return this.treeFolder(context, DOCS_TREE.organization, await this.root(context), EVER_WORKS_DOCS_ORGANIZATION_NAME);
	}

	/** `Ever Works/Works/`. */
	async worksFolder(context: EverWorksMappingContext): Promise<ID> {
		return this.treeFolder(context, DOCS_TREE.works, await this.root(context), EVER_WORKS_DOCS_WORKS_NAME);
	}

	/**
	 * `Ever Works/Works/<Work name>/`: one Work's documents, linked to the Work's paired project (a
	 * `DocumentLink` to the `OrganizationProject`) when there is one.
	 */
	async workFolder(context: EverWorksMappingContext, workId: string, workName: string, projectId: ID | null): Promise<ID> {
		const id = await this.treeFolder(context, DOCS_TREE.work(workId), await this.worksFolder(context), cut(workName || 'Work', 255));
		if (projectId) await this.linkToProject(context, id, projectId);
		return id;
	}

	/**
	 * A folder the sync keeps, found by its marker (and revived when it was archived or deleted), else
	 * created under `parentId`. A folder an admin moved elsewhere is left where it is (a change of the docs root moves
	 * the tree folders, `placeTree`).
	 */
	async treeFolder(context: EverWorksMappingContext, marker: string, parentId: ID | null, name: string): Promise<ID> {
		const existing = await this.byExternalId(context, marker);
		if (existing) {
			if ((existing as { deletedAt?: Date | null }).deletedAt || existing.isArchived) {
				await this.dataSource.getRepository(Document).restore({ id: existing.id } as never);
				await this.dataSource.getRepository(Document).update({ id: existing.id } as never, { isArchived: false, archivedAt: null } as never);
			}
			return existing.id as ID;
		}
		return this.createFolder(context, { name, parentId, externalId: marker });
	}

	/** Creates a folder of the synced tree (organization-visible, from the integration). */
	async createFolder(context: EverWorksMappingContext, input: { name: string; parentId: ID | null; externalId: string | null }): Promise<ID> {
		const id = randomUUID() as ID;
		await this.dataSource.getRepository(Document).insert({
			id,
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			kind: DocumentKindEnum.FOLDER,
			name: cut(input.name, 255) || 'Folder',
			parentId: input.parentId,
			index: await this.nextIndex(context, input.parentId),
			version: 1,
			status: DocumentStatusEnum.READY,
			source: DocumentSourceEnum.INTEGRATION,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			reviewStatus: DocumentReviewStatusEnum.NONE,
			visibility: DocumentVisibilityEnum.ORGANIZATION,
			searchable: true,
			isLocked: false,
			extractedTextEdited: false,
			...(input.externalId ? { externalSource: EVER_WORKS_DOCS_SOURCE, externalId: input.externalId } : {})
		} as never);
		return id;
	}

	/** Creates a synced page under `parentId`; returns its id. */
	async createPage(context: EverWorksMappingContext, parentId: ID, externalId: string, fields: DocsPageFields): Promise<ID> {
		const id = randomUUID() as ID;
		await this.dataSource.getRepository(Document).insert({
			id,
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			kind: DocumentKindEnum.PAGE,
			parentId,
			index: await this.nextIndex(context, parentId),
			version: 1,
			status: DocumentStatusEnum.READY,
			source: DocumentSourceEnum.INTEGRATION,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			visibility: DocumentVisibilityEnum.ORGANIZATION,
			searchable: true,
			extractedTextEdited: false,
			externalSource: EVER_WORKS_DOCS_SOURCE,
			externalId,
			...this.columnsOf(fields)
		} as never);
		return id;
	}

	/** Writes a synced page's fields (and moves it under `parentId` when given). */
	async updatePage(context: EverWorksMappingContext, id: ID, fields: Partial<DocsPageFields>, parentId?: ID): Promise<void> {
		const values: Record<string, unknown> = { ...this.columnsOf(fields) };
		if (parentId) values['parentId'] = parentId;
		if (Object.keys(values).length) await this.dataSource.getRepository(Document).update({ id, tenantId: context.tenantId } as never, values as never);
	}

	/** Archives a node (the delete policy: nothing is hard-deleted, plan 05 §3). */
	async archive(context: EverWorksMappingContext, id: ID): Promise<void> {
		await this.dataSource.getRepository(Document).update({ id, tenantId: context.tenantId } as never, { isArchived: true, archivedAt: new Date() } as never);
	}

	async unarchive(context: EverWorksMappingContext, id: ID): Promise<void> {
		await this.dataSource.getRepository(Document).update({ id, tenantId: context.tenantId } as never, { isArchived: false, archivedAt: null } as never);
	}

	/** Renames and / or moves a folder. */
	async updateFolder(context: EverWorksMappingContext, id: ID, values: { name?: string; parentId?: ID }): Promise<void> {
		const changes: Record<string, unknown> = {};
		if (values.name !== undefined) changes['name'] = cut(values.name, 255) || 'Folder';
		if (values.parentId !== undefined) changes['parentId'] = values.parentId;
		if (Object.keys(changes).length) await this.dataSource.getRepository(Document).update({ id, tenantId: context.tenantId } as never, changes as never);
	}

	/**
	 * Stores the page's current content as a `DocumentVersion` (restorable from the page's history) and
	 * moves the page's version counter on, as the Docs plugin's own snapshot does. `label` names the
	 * snapshot (the conflict copy is "Gauzy edit (conflict)", plan 05 §3). Returns the version id, or
	 * `null` when the page has no content to keep.
	 */
	async snapshot(context: EverWorksMappingContext, page: Document, label?: string, force = false): Promise<ID | null> {
		if (page.kind !== DocumentKindEnum.PAGE || (!page.contentJson && !page.contentHtml)) return null;
		// `force`: the page holds an edit made since the last sync write (one the Markdown may not show): it is kept even
		// inside the window, so a later write never loses it (review F92).
		if (!label && !force) {
			// A run of sync writes rolls up into one snapshot per window (as the editor's autosaves do); a
			// labelled copy (the conflict) is always kept.
			const recent = await this.dataSource.getRepository(DocumentVersion).findOne({
				where: { documentId: page.id, tenantId: context.tenantId, createdById: IsNull(), lastSavedAt: MoreThan(new Date(Date.now() - SNAPSHOT_WINDOW_MS)) } as never
			});
			if (recent) return null;
		}
		const id = randomUUID() as ID;
		await this.dataSource.getRepository(DocumentVersion).insert({
			id,
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			documentId: page.id,
			name: cut(label ? `${page.name} — ${label}` : page.name, 255),
			contentJson: page.contentJson ?? null,
			contentHtml: page.contentHtml ?? null,
			contentBinary: page.contentBinary ?? null,
			lastSavedAt: new Date(),
			createdById: null
		} as never);
		await this.dataSource
			.getRepository(Document)
			.update({ id: page.id, tenantId: context.tenantId } as never, { version: (page.version ?? 1) + 1 } as never);
		page.version = (page.version ?? 1) + 1;
		return id;
	}

	/** Links a Work's folder to its paired project (once). */
	async linkToProject(context: EverWorksMappingContext, documentId: ID, projectId: ID): Promise<void> {
		const repository = this.dataSource.getRepository(DocumentLink);
		const where = { documentId, entity: BaseEntityEnum.OrganizationProject, entityId: projectId };
		if (await repository.findOne({ where: where as never })) return;
		await repository.insert({ id: randomUUID(), tenantId: context.tenantId, organizationId: context.organizationId, ...where } as never);
	}

	private columnsOf(fields: Partial<DocsPageFields>): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		if (fields.name !== undefined) out['name'] = cut(fields.name, 255) || 'Untitled';
		if (fields.description !== undefined) out['description'] = fields.description;
		if (fields.contentJson !== undefined) out['contentJson'] = fields.contentJson;
		if (fields.contentHtml !== undefined) out['contentHtml'] = fields.contentHtml;
		if (fields.isLocked !== undefined) out['isLocked'] = fields.isLocked;
		if (fields.reviewStatus !== undefined) {
			out['reviewStatus'] = fields.reviewStatus;
			out['reviewReason'] = fields.reviewReason ?? null;
			out['reviewedAt'] = fields.reviewStatus === DocumentReviewStatusEnum.APPROVED ? new Date() : null;
		}
		if (fields.metadata !== undefined) out['metadata'] = fields.metadata;
		return out;
	}

	/** The next sibling position under a parent (new nodes go last). */
	private async nextIndex(context: EverWorksMappingContext, parentId: ID | null): Promise<number> {
		const row = await this.dataSource
			.getRepository(Document)
			.createQueryBuilder('document')
			.select('MAX(document.index)', 'max')
			.where('document.tenantId = :tenantId', { tenantId: context.tenantId })
			.andWhere('document.organizationId = :organizationId', { organizationId: context.organizationId })
			.andWhere(parentId ? 'document.parentId = :parentId' : 'document.parentId IS NULL', parentId ? { parentId } : {})
			.getRawOne<{ max: number | string | null }>();
		const max = Number(row?.max ?? -1);
		return Number.isFinite(max) ? max + 1 : 0;
	}

	private async saveSetting(context: EverWorksMappingContext, name: EverWorksSettingName, value: string): Promise<void> {
		const repository = this.dataSource.getRepository(IntegrationSetting);
		const existing = await repository.findOne({ where: { integrationId: context.integrationTenantId, settingsName: name } as never });
		if (existing) await repository.update({ id: existing.id } as never, { settingsValue: value } as never);
		else
			await repository.insert({
				id: randomUUID(),
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationId: context.integrationTenantId,
				settingsName: name,
				settingsValue: value
			} as never);
		const row = context.mapping.settings?.find((setting) => setting.settingsName === name);
		if (row) row.settingsValue = value;
		else context.mapping.settings = [...(context.mapping.settings ?? []), { settingsName: name, settingsValue: value } as never];
	}
}
