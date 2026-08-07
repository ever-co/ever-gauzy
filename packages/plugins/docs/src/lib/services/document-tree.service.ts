import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { DocumentKindEnum, DocumentKnowledgeStatusEnum, DocumentReviewStatusEnum, ID } from '@gauzy/contracts';
import {
	DOCS_DELETE_REQUIRES_ARCHIVE,
	DOCS_PARENT_NOT_CONTAINER,
	DOCS_REORDER_MIXED_PARENTS,
	DOCS_SUBTREE_NOT_ARCHIVED,
	DOCS_TREE_CYCLE
} from '../docs.constants';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';

/**
 * Tree mechanics for the Documents hub: ancestor-chain walks, the move cycle guard, subtree
 * collection (iterative BFS — dialect-portable), sibling `index` maintenance, deep duplicate,
 * archive/unarchive cascade, and the delete strategies (`subtree` vs `promote-children`).
 */
@Injectable()
export class DocumentTreeService {
	private readonly logger = new Logger(DocumentTreeService.name);

	constructor(private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository) {}

	/**
	 * Collects the ids of a node's whole subtree (including the root) with an iterative
	 * breadth-first walk — portable across all three dialects.
	 *
	 * @param root The subtree root.
	 * @param withDeleted Include soft-deleted rows (used by recover).
	 * @returns All subtree ids, root first.
	 */
	async collectSubtreeIds(root: Document, withDeleted = false): Promise<ID[]> {
		const ids: ID[] = [root.id];
		let frontier: ID[] = [root.id];

		while (frontier.length > 0) {
			const children = await this.typeOrmDocumentRepository.find({
				select: { id: true },
				where: {
					parentId: In(frontier),
					tenantId: root.tenantId,
					organizationId: root.organizationId
				},
				withDeleted
			});
			frontier = children.map((child: Document) => child.id).filter((id: ID) => !ids.includes(id));
			ids.push(...frontier);
		}

		return ids;
	}

	/**
	 * Guards against tree cycles: the new parent must not be the node itself or any of its
	 * descendants. Violations raise 409 `DOCS_TREE_CYCLE`.
	 *
	 * @param document The node being moved.
	 * @param newParentId The prospective parent id.
	 */
	async assertNoCycle(document: Document, newParentId: ID): Promise<void> {
		if (newParentId === document.id) {
			throw new ConflictException({ message: 'A document cannot be its own parent', code: DOCS_TREE_CYCLE });
		}

		// Walk the new ancestor chain up to the root. `visited` is the defensive stop: a cycle
		// already present in the data (written by any path that re-parents without this guard)
		// would otherwise spin this loop forever instead of failing the request.
		const visited = new Set<ID>();
		let cursorId: ID | null = newParentId;
		while (cursorId) {
			if (cursorId === document.id) {
				throw new ConflictException({
					message: 'Moving a document under its own descendant would create a cycle',
					code: DOCS_TREE_CYCLE
				});
			}
			if (visited.has(cursorId)) {
				throw new ConflictException({
					message: 'The document tree already contains a cycle above the target parent',
					code: DOCS_TREE_CYCLE
				});
			}
			visited.add(cursorId);
			const cursor = await this.typeOrmDocumentRepository.findOne({
				select: { id: true, parentId: true },
				where: { id: cursorId, tenantId: document.tenantId, organizationId: document.organizationId }
			});
			cursorId = cursor?.parentId ?? null;
		}
	}

	/**
	 * Moves a node to a new parent (`null` = root) at an optional sibling position; sibling
	 * `index` values are compacted after insert.
	 *
	 * @param document The node to move.
	 * @param parentId The new parent id or null.
	 * @param index The target sibling position (appends when omitted).
	 * @returns The moved document.
	 */
	async moveDocument(document: Document, parentId: ID | null, index?: number): Promise<Document> {
		if (parentId) {
			const parent = await this.typeOrmDocumentRepository.findOne({
				where: { id: parentId, tenantId: document.tenantId, organizationId: document.organizationId }
			});
			if (!parent) {
				throw new NotFoundException(`Document ${parentId} was not found`);
			}
			if (parent.kind === DocumentKindEnum.FILE) {
				throw new BadRequestException({
					message: 'A FILE document can never be a parent',
					code: DOCS_PARENT_NOT_CONTAINER
				});
			}
			await this.assertNoCycle(document, parentId);
		}

		const sourceParentId = document.parentId ?? null;
		const targetParentId = parentId ?? null;

		// Load the target sibling list (without the moved node), splice, and rewrite indexes
		const orderedIds = (await this.loadSiblingIds(targetParentId, document)).filter((id: ID) => id !== document.id);
		const insertAt = index === undefined || index > orderedIds.length ? orderedIds.length : Math.max(0, index);
		orderedIds.splice(insertAt, 0, document.id);

		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId },
			{ parentId: targetParentId }
		);
		await this.rewriteSiblingIndexes(orderedIds, document.tenantId);

		// The node left a hole in its previous sibling list — compact that list too, otherwise
		// the source parent keeps a gap and later inserts (which append at `length`) collide
		// with an index that is still in use.
		if (sourceParentId !== targetParentId) {
			const sourceIds = (await this.loadSiblingIds(sourceParentId, document)).filter(
				(id: ID) => id !== document.id
			);
			await this.rewriteSiblingIndexes(sourceIds, document.tenantId);
		}

		return this.typeOrmDocumentRepository.findOne({
			where: { id: document.id, tenantId: document.tenantId }
		});
	}

	/**
	 * Loads the ids of one parent's children (`null` = root siblings) in `index` order, scoped
	 * to the reference document's tenant + organization.
	 *
	 * @param parentId The parent whose children to load, or null for the root list.
	 * @param scope A document carrying the tenant/organization scope.
	 * @returns The sibling ids in `index` order.
	 */
	private async loadSiblingIds(parentId: ID | null, scope: Document): Promise<ID[]> {
		const siblings = await this.typeOrmDocumentRepository.find({
			select: { id: true, index: true },
			where: {
				parentId: parentId ?? IsNull(),
				tenantId: scope.tenantId,
				organizationId: scope.organizationId
			},
			order: { index: 'ASC' }
		});
		return siblings.map((sibling: Document) => sibling.id);
	}

	/**
	 * Rewrites `index` for the listed siblings of one parent (`null` = root siblings).
	 * Ids that are not children of `parentId` yield 400 `DOCS_REORDER_MIXED_PARENTS`.
	 *
	 * @param parentId The common parent id or null.
	 * @param orderedIds The sibling ids in the desired order.
	 * @param tenantId Tenant scope.
	 * @param organizationId Optional organization scope.
	 */
	async reorderDocuments(parentId: ID | null, orderedIds: ID[], tenantId: ID, organizationId?: ID): Promise<void> {
		const children = await this.typeOrmDocumentRepository.find({
			select: { id: true },
			where: { parentId: parentId ?? IsNull(), tenantId, ...(organizationId && { organizationId }) }
		});
		const childIds = new Set(children.map((child: Document) => child.id));
		const stranger = orderedIds.find((id: ID) => !childIds.has(id));
		if (stranger) {
			throw new BadRequestException({
				message: `Document ${stranger} is not a child of the given parent`,
				code: DOCS_REORDER_MIXED_PARENTS
			});
		}
		await this.rewriteSiblingIndexes(orderedIds, tenantId);
	}

	/**
	 * Duplicates a node (optionally its whole subtree). PAGE content columns are copied; FILE
	 * copies re-use the same storage key (bytes are not duplicated) with an independent row.
	 * Versions, comments, shares, links, and knowledge state are **not** copied — the copy
	 * starts `knowledgeStatus: NONE`, `reviewStatus: NONE`.
	 *
	 * @param document The source node.
	 * @param options `deep` copies the subtree; `parentId`/`name` override the target.
	 * @returns The new root node of the copy.
	 */
	async duplicateDocument(
		document: Document,
		options: { deep?: boolean; parentId?: ID; name?: string } = {}
	): Promise<Document> {
		const copyRoot = await this.copyNode(document, options.parentId ?? document.parentId ?? null, options.name);

		if (options.deep) {
			await this.copyChildrenRecursive(document, copyRoot);
		}

		return copyRoot;
	}

	/**
	 * Archives a node and **cascades to the whole subtree**. Idempotent.
	 *
	 * @param document The subtree root.
	 * @returns The affected row count.
	 */
	async archiveSubtree(document: Document): Promise<number> {
		const ids = await this.collectSubtreeIds(document);
		await this.typeOrmDocumentRepository.update(
			{ id: In(ids), tenantId: document.tenantId },
			{ isArchived: true, archivedAt: new Date() }
		);
		return ids.length;
	}

	/**
	 * Clears the archive flags on the subtree, plus any archived ancestors needed to make the
	 * node reachable through the tree again. Idempotent.
	 *
	 * @param document The subtree root.
	 * @returns The affected row count.
	 */
	async unarchiveSubtree(document: Document): Promise<number> {
		const ids = await this.collectSubtreeIds(document);

		// Ancestors needed for reachability. `visited` is the defensive stop — a pre-existing
		// cycle in the ancestor chain must abort the walk, not hang the request forever.
		const visited = new Set<ID>(ids);
		let cursorId: ID | null = document.parentId ?? null;
		while (cursorId && !visited.has(cursorId)) {
			visited.add(cursorId);
			ids.push(cursorId);
			const cursor = await this.typeOrmDocumentRepository.findOne({
				select: { id: true, parentId: true },
				where: { id: cursorId, tenantId: document.tenantId, organizationId: document.organizationId }
			});
			cursorId = cursor?.parentId ?? null;
		}

		await this.typeOrmDocumentRepository.update(
			{ id: In(ids), tenantId: document.tenantId },
			{ isArchived: false, archivedAt: null }
		);
		return ids.length;
	}

	/**
	 * Soft delete — **allowed only from archived state** (archive-first workflow; else 409).
	 * `subtree` (default) soft-deletes the descendants too, stamping `metadata.deletion.batchId`
	 * so recovery restores exactly the rows deleted by this operation; `promote-children`
	 * re-parents children to the deleted node's parent preserving relative `index` order.
	 *
	 * @param document The node to delete.
	 * @param strategy The delete strategy.
	 * @returns The soft-deleted document.
	 */
	async deleteDocument(document: Document, strategy: 'subtree' | 'promote-children' = 'subtree'): Promise<Document> {
		if (!document.isArchived) {
			throw new ConflictException({
				message: 'Documents can be deleted only from the archive',
				code: DOCS_DELETE_REQUIRES_ARCHIVE
			});
		}

		if (strategy === 'promote-children') {
			// Re-parent children to the deleted node's parent, preserving relative order
			const promotedIds = await this.loadSiblingIds(document.id, document);
			for (const childId of promotedIds) {
				await this.typeOrmDocumentRepository.update(
					{ id: childId, tenantId: document.tenantId },
					{ parentId: document.parentId ?? null }
				);
			}
			await this.typeOrmDocumentRepository.softDelete({ id: document.id, tenantId: document.tenantId });

			// The promoted children join their grandparent's sibling list, and the deleted node
			// vacates its own slot — renumber the destination list so the merged order is a
			// dense 0..n-1 sequence instead of two interleaved index ranges.
			const destinationIds = (await this.loadSiblingIds(document.parentId ?? null, document)).filter(
				(id: ID) => id !== document.id
			);
			await this.rewriteSiblingIndexes(destinationIds, document.tenantId);
		} else {
			// Subtree delete: the archive-first workflow applies to the WHOLE subtree, not just
			// its root — otherwise deleting an archived folder silently trashes live children
			// that were never archived (and never appeared in the archive view).
			await this.assertSubtreeArchived(document);

			// Stamp the batch id, then soft-delete every row
			const ids = await this.collectSubtreeIds(document);
			const batchId = `${document.id}:${Date.now()}`;
			const rows = await this.typeOrmDocumentRepository.find({
				where: { id: In(ids), tenantId: document.tenantId }
			});
			for (const row of rows) {
				const metadata = (typeof row.metadata === 'object' && row.metadata) || {};
				row.metadata = this.serializeMetadata({ ...metadata, deletion: { batchId } });
			}
			await this.typeOrmDocumentRepository.save(rows);
			await this.typeOrmDocumentRepository.softDelete({ id: In(ids), tenantId: document.tenantId });
		}

		return this.typeOrmDocumentRepository.findOne({
			where: { id: document.id, tenantId: document.tenantId },
			withDeleted: true
		});
	}

	/**
	 * Asserts that every node of a subtree is archived before a `subtree` delete.
	 *
	 * @param document The subtree root (already known to be archived).
	 */
	private async assertSubtreeArchived(document: Document): Promise<void> {
		const ids = await this.collectSubtreeIds(document);
		const live = await this.typeOrmDocumentRepository.find({
			select: { id: true, name: true },
			where: { id: In(ids), tenantId: document.tenantId, isArchived: false }
		});
		if (live.length > 0) {
			const names = live.slice(0, 5).map((row: Document) => row.name ?? row.id);
			throw new ConflictException({
				message:
					`This document has ${live.length} descendant(s) that are not archived and would be ` +
					`deleted silently: ${names.join(', ')}${live.length > names.length ? ', …' : ''}. ` +
					`Archive the whole subtree first, or delete with strategy=promote-children.`,
				code: DOCS_SUBTREE_NOT_ARCHIVED,
				documentIds: live.map((row: Document) => row.id)
			});
		}
	}

	/**
	 * Restores a soft-deleted document (and the rows deleted in the same batch, when it was a
	 * subtree delete). Re-parents to root if the original parent is still deleted; the document
	 * returns in archived state.
	 *
	 * The caller **must** hand in a row it already resolved through the read scope
	 * (`DocumentService.findOneDeletedScoped`) — this method takes the entity, not an id, so a
	 * tenant-only lookup can never be the thing that authorizes an un-delete.
	 *
	 * @param document The soft-deleted document, already resolved within the caller's scope.
	 * @returns The recovered document.
	 */
	async recoverDocument(document: Document): Promise<Document> {
		if (!document.deletedAt) {
			throw new NotFoundException(`Deleted document ${document.id} was not found`);
		}
		const { id, tenantId, organizationId } = document;

		// Restore the whole deletion batch when present, else just the node
		const metadata = this.parseMetadata(document.metadata);
		const batchId: string | undefined = metadata?.deletion?.batchId;
		if (batchId) {
			const batchRows = await this.typeOrmDocumentRepository
				.createQueryBuilder('document')
				.withDeleted()
				.where('document.tenantId = :tenantId', { tenantId })
				.andWhere('document.organizationId = :organizationId', { organizationId })
				.andWhere('document.deletedAt IS NOT NULL')
				.getMany();
			const batchIds = batchRows
				.filter((row: Document) => this.parseMetadata(row.metadata)?.deletion?.batchId === batchId)
				.map((row: Document) => row.id);
			if (batchIds.length > 0) {
				await this.typeOrmDocumentRepository.restore({ id: In(batchIds), tenantId });
			}
		} else {
			await this.typeOrmDocumentRepository.restore({ id, tenantId });
		}

		// Re-parent to root if the original parent is still deleted
		if (document.parentId) {
			const parent = await this.typeOrmDocumentRepository.findOne({
				where: { id: document.parentId, tenantId, organizationId }
			});
			if (!parent) {
				await this.typeOrmDocumentRepository.update({ id, tenantId }, { parentId: null });
			}
		}

		return this.typeOrmDocumentRepository.findOne({ where: { id, tenantId, organizationId } });
	}

	/**
	 * Copies one node (shallow).
	 */
	private async copyNode(source: Document, parentId: ID | null, name?: string): Promise<Document> {
		const copy = this.typeOrmDocumentRepository.create({
			tenantId: source.tenantId,
			organizationId: source.organizationId,
			kind: source.kind,
			parentId,
			index: (source.index ?? 0) + 1,
			name: name ?? `${source.name} (copy)`,
			icon: source.icon,
			color: source.color,
			description: source.description,
			contentJson: source.contentJson ?? null,
			contentHtml: source.contentHtml ?? null,
			contentBinary: source.contentBinary ?? null,
			isLocked: false,
			storageProvider: source.storageProvider,
			storageKey: source.storageKey,
			thumbKey: source.thumbKey,
			mimeType: source.mimeType,
			fileSize: source.fileSize,
			sha256: source.sha256,
			originalFilename: source.originalFilename,
			version: 1,
			extractedText: source.extractedText,
			extractedTextEdited: source.extractedTextEdited,
			summary: source.summary,
			status: source.status,
			source: source.source,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			searchable: source.searchable,
			reviewStatus: DocumentReviewStatusEnum.NONE,
			visibility: source.visibility
		});
		return this.typeOrmDocumentRepository.save(copy);
	}

	/**
	 * Breadth-first deep copy of the children of `source` under `target`.
	 */
	private async copyChildrenRecursive(source: Document, target: Document): Promise<void> {
		const children = await this.typeOrmDocumentRepository.find({
			where: { parentId: source.id, tenantId: source.tenantId, organizationId: source.organizationId },
			order: { index: 'ASC' }
		});
		for (const child of children) {
			const childCopy = await this.copyNode(child, target.id, child.name);
			await this.copyChildrenRecursive(child, childCopy);
		}
	}

	/**
	 * Rewrites the `index` column to match the given order.
	 */
	private async rewriteSiblingIndexes(orderedIds: ID[], tenantId: ID): Promise<void> {
		for (let position = 0; position < orderedIds.length; position++) {
			await this.typeOrmDocumentRepository.update({ id: orderedIds[position], tenantId }, { index: position });
		}
	}

	/**
	 * Serializes a metadata object for persistence (plain text column on SQLite).
	 */
	private serializeMetadata(value: Record<string, any>): any {
		return isSqlite() || isBetterSqlite3() ? JSON.stringify(value) : value;
	}

	/**
	 * Parses a metadata value that may still be serialized (SQLite path).
	 */
	private parseMetadata(value: any): Record<string, any> | null {
		if (!value) {
			return null;
		}
		if (typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch {
				return null;
			}
		}
		return value;
	}
}
