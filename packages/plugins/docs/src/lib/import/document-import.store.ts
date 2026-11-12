import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { In, LessThan } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	FileStorageProviderEnum,
	ID
} from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { FileStorage, readStorageFileAsBuffer, sanitizeRichHtml } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { Document } from '../entities/document.entity';
import { DocumentImport } from '../entities/document-import.entity';
import { DocumentLink } from '../entities/document-link.entity';
import { TypeOrmDocumentImportRepository } from '../repositories/type-orm-document-import.repository';
import { TypeOrmDocumentLinkRepository } from '../repositories/type-orm-document-link.repository';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { IDocNode } from '../services/document-markdown';
import { DocumentProcessingService } from '../services/document-processing.service';
import { DocumentQuotaService } from '../services/document-quota.service';
import { canonicalExtension } from '../services/file-sniffer';
import { generateDocumentHtml } from '../validation/tiptap-html.serializer';
import { collectDocumentMentionIds, stripTransientAttributes, validateTiptapDocument } from '../validation/tiptap-schema.validator';
import { ICreateImportedFile, ICreateImportedNode, IDocumentImportStore, IImportedDocumentRef, IImportRow, IImportScope } from './document-import.types';
import { ImportTenantStorage } from './import-tenant-storage';

/** A JSON value as its column takes it: text on SQLite, an object elsewhere. */
function jsonColumn(value: unknown): unknown {
	return value && typeof value === 'object' && (isSqlite() || isBetterSqlite3()) ? JSON.stringify(value) : value;
}

/** The content revision a page is created with (the column's default): the import writes the page only from it. */
const IMPORTED_PAGE_REVISION = 1;

/** A path segment from an id: the ids are UUIDs, but a storage key segment is never built from an unchecked value. */
const segment = (value: unknown): string => String(value ?? '').replace(/[^a-zA-Z0-9-]/g, '') || randomUUID();

/** The storage key of an uploaded import zip: the shape of the upload endpoint's keys, under `imports/`. */
export function importArchiveKeyOf(scope: IImportScope): string {
	return `documents/${segment(scope.tenantId)}/${segment(scope.organizationId)}/imports/${randomUUID()}.zip`;
}

/**
 * The persistence and storage seam of the import runner (`IDocumentImportStore`) over TypeORM and the platform's file
 * storage. Every query carries the job's tenant / organization snapshot — a queue thread has no request context.
 *
 * 🛑 The platform's base subscriber stamps `createdByUserId` from the request context on insert, which a queue thread
 * does not have: an imported PRIVATE page would belong to no one and be readable by no one but a Docs manager. Every
 * created row is therefore re-stamped with the importing member (and the export's created date) by an update that
 * runs without listeners.
 *
 * The storage reads and writes run with the tenant's own storage settings (`ImportTenantStorage`): a queue thread has
 * no request to read a tenant's bucket and credentials from.
 */
@Injectable()
export class DocumentImportStore implements IDocumentImportStore {
	private readonly logger = new Logger(DocumentImportStore.name);

	constructor(
		private readonly imports: TypeOrmDocumentImportRepository,
		private readonly documents: TypeOrmDocumentRepository,
		private readonly links: TypeOrmDocumentLinkRepository,
		private readonly processing: DocumentProcessingService,
		private readonly quota: DocumentQuotaService,
		private readonly storage: ImportTenantStorage
	) {}

	async load(id: ID, scope: IImportScope): Promise<IImportRow | null> {
		return (await this.imports.findOne({ where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } })) as IImportRow | null;
	}

	async claim(id: ID, scope: IImportScope, staleBefore: Date, patch: Partial<IImportRow>): Promise<boolean> {
		const base = { id, tenantId: scope.tenantId, organizationId: scope.organizationId };
		for (const where of [
			{ ...base, status: DocumentImportStatusEnum.QUEUED },
			{ ...base, status: DocumentImportStatusEnum.RUNNING, lastProgressAt: LessThan(staleBefore) }
		]) {
			const result = await this.imports.createQueryBuilder().update(DocumentImport).set(patch as never).where(where).callListeners(false).execute();
			if ((result.affected ?? 0) > 0) return true;
		}
		return false;
	}

	async update(id: ID, scope: IImportScope, patch: Partial<IImportRow>, fence?: number): Promise<boolean> {
		// A fenced write also needs the import RUNNING: only a claim makes it RUNNING (and moves `attempts`), so a run the
		// stalled-import sweep sent back to QUEUED, or gave up (FAILED), writes nothing more.
		const fenced = fence === undefined ? {} : { attempts: fence, status: DocumentImportStatusEnum.RUNNING };
		const result = await this.imports
			.createQueryBuilder()
			.update(DocumentImport)
			.set(patch as never)
			.where({ id, tenantId: scope.tenantId, organizationId: scope.organizationId, ...fenced })
			.callListeners(false)
			.execute();
		return (result.affected ?? 0) > 0;
	}

	async readArchive(row: IImportRow): Promise<Buffer> {
		const key = row.storageKey;
		if (!key) throw new Error('The import has no stored archive');
		return this.storage.run(row.tenantId, async () => {
			const provider = new FileStorage().setProvider(row.storageProvider ?? undefined).getProviderInstance();
			return readStorageFileAsBuffer(provider, key, { maxBytes: Math.max(getDocsConfig().importMaxZipBytes, Number(row.fileSize) || 0) });
		});
	}

	async discardArchive(row: IImportRow, fence?: number): Promise<void> {
		const key = row.storageKey;
		if (!key) return;
		// Inside the tenant's storage settings: when they cannot be read, the import keeps the key of the zip it could not
		// delete.
		await this.storage.run(row.tenantId, async () => {
			// The key is forgotten first, by the run that still owns the import: a run taken over deletes nothing.
			const result = await this.imports
				.createQueryBuilder()
				.update(DocumentImport)
				.set({ storageKey: null } as never)
				.where({
					id: row.id,
					tenantId: row.tenantId,
					organizationId: row.organizationId,
					storageKey: key,
					...(fence === undefined ? {} : { attempts: fence })
				})
				.callListeners(false)
				.execute();
			if (!result.affected) return;
			const provider = new FileStorage().setProvider(row.storageProvider ?? undefined).getProviderInstance();
			await provider.deleteFile(key);
		});
	}

	async findImported(scope: IImportScope, externalSource: string, externalId: string): Promise<IImportedDocumentRef | null> {
		const found = await this.documents.findOne({
			select: { id: true, kind: true, name: true, mimeType: true, fileSize: true },
			where: { tenantId: scope.tenantId, organizationId: scope.organizationId, externalSource, externalId } as never,
			withDeleted: true
		});
		return found ? { id: found.id as ID, kind: found.kind, name: found.name, mimeType: found.mimeType ?? null, fileSize: found.fileSize ?? null } : null;
	}

	async adoptImported(id: ID, ownerUserId: ID | null, createdAt?: Date): Promise<void> {
		await this.stamp(id, ownerUserId, createdAt);
	}

	async createNode(input: ICreateImportedNode): Promise<IImportedDocumentRef> {
		const saved = await this.documents.save(
			this.documents.create({
				tenantId: input.scope.tenantId,
				organizationId: input.scope.organizationId,
				kind: input.kind,
				name: input.name,
				parentId: input.parentId ?? null,
				index: input.index,
				...(input.icon ? { icon: input.icon } : {}),
				visibility: input.visibility,
				organizationTeamId: input.organizationTeamId ?? null,
				status: DocumentStatusEnum.READY,
				source: DocumentSourceEnum.IMPORT,
				knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
				reviewStatus: DocumentReviewStatusEnum.NONE,
				externalSource: input.externalSource,
				externalId: input.externalId,
				...(input.kind === DocumentKindEnum.PAGE ? { contentJson: jsonColumn({ type: 'doc', content: [{ type: 'paragraph' }] }) } : {}),
				metadata: jsonColumn(input.metadata)
			} as Partial<Document> as Document)
		);
		await this.stamp(saved.id as ID, input.ownerUserId, input.createdAt);
		return { id: saved.id as ID, kind: input.kind, name: input.name };
	}

	async createFile(input: ICreateImportedFile): Promise<IImportedDocumentRef> {
		const key = `documents/${segment(input.scope.tenantId)}/${segment(input.scope.organizationId)}/${randomUUID()}.${canonicalExtension(input.mimeType)}`;
		// The tenant's provider and bucket, as an upload of the member would use.
		const { providerName, stored } = await this.storage.run(input.scope.tenantId, async () => {
			const provider = new FileStorage().getProvider();
			return { providerName: String(provider.name), stored: await provider.putFile(input.buffer, key) };
		});
		const storageProvider = providerName.toUpperCase() as FileStorageProviderEnum;
		let saved: Document;
		try {
			saved = await this.documents.save(
				this.documents.create({
					tenantId: input.scope.tenantId,
					organizationId: input.scope.organizationId,
					kind: DocumentKindEnum.FILE,
					name: input.name,
					parentId: input.parentId ?? null,
					index: input.index,
					visibility: input.visibility,
					organizationTeamId: input.organizationTeamId ?? null,
					status: DocumentStatusEnum.UPLOADED,
					source: DocumentSourceEnum.IMPORT,
					knowledgeStatus: input.importToKnowledge ? DocumentKnowledgeStatusEnum.QUEUED : DocumentKnowledgeStatusEnum.NONE,
					reviewStatus: DocumentReviewStatusEnum.NONE,
					storageProvider,
					storageKey: stored.key,
					mimeType: input.mimeType,
					fileSize: input.buffer.length,
					sha256: input.sha256,
					originalFilename: input.name,
					version: 1,
					externalSource: input.externalSource,
					externalId: input.externalId,
					metadata: jsonColumn({ ...input.metadata, upload: { canonicalExtension: canonicalExtension(input.mimeType) } })
				} as Partial<Document> as Document)
			);
		} catch (error) {
			// The row is the only thing that names the blob: without it the blob would be stored forever.
			await this.storage
				.run(input.scope.tenantId, async () => {
					await new FileStorage().setProvider(storageProvider).getProviderInstance().deleteFile(stored.key);
				})
				.catch(() => undefined);
			throw error;
		}
		await this.stamp(saved.id as ID, input.ownerUserId, input.createdAt);
		try {
			await this.processing.enqueueExtract(saved, 'import');
		} catch (error) {
			// The recovery sweep re-drives an UPLOADED row that has no job.
			this.logger.warn(`Import: docs.extract could not be enqueued for ${saved.id}: ${(error as Error)?.message ?? error}`);
		}
		return { id: saved.id as ID, kind: DocumentKindEnum.FILE, name: input.name, mimeType: input.mimeType, fileSize: input.buffer.length };
	}

	async writePage(document: IImportedDocumentRef, scope: IImportScope, contentJson: IDocNode, ownerUserId: ID | null): Promise<boolean> {
		const valid = stripTransientAttributes(validateTiptapDocument(contentJson));
		let contentHtml: string | null = null;
		try {
			contentHtml = sanitizeRichHtml(generateDocumentHtml(valid));
		} catch (error) {
			this.logger.warn(`Import: the HTML of page ${document.id} could not be derived: ${(error as Error)?.message ?? error}`);
		}
		// The content-write contract of a save (`claimNextContentRevision`): the revision moves from the one the page was
		// created with to the next in the same conditional update, so a save of the page loaded before this write is
		// refused (409) instead of overwriting the imported content, and a page saved meanwhile is not overwritten.
		const result = await this.documents
			.createQueryBuilder()
			.update(Document)
			.set({
				contentJson: jsonColumn(valid),
				contentHtml,
				contentRevision: IMPORTED_PAGE_REVISION + 1,
				...(ownerUserId ? { updatedByUserId: ownerUserId } : {})
			} as never)
			.where({ id: document.id, tenantId: scope.tenantId, organizationId: scope.organizationId, contentRevision: IMPORTED_PAGE_REVISION })
			.callListeners(false)
			.execute();
		return (result.affected ?? 0) > 0;
	}

	async mentionsOf(documentId: ID, scope: IImportScope): Promise<Set<string>> {
		const page = await this.documents.findOne({
			select: { id: true, contentJson: true },
			where: { id: documentId, tenantId: scope.tenantId, organizationId: scope.organizationId } as never
		});
		let content: unknown = page?.contentJson ?? null;
		if (typeof content === 'string') {
			try {
				content = JSON.parse(content);
			} catch {
				content = null;
			}
		}
		return new Set(collectDocumentMentionIds(content));
	}

	async linkPages(documentId: ID, mentionedIds: ID[], scope: IImportScope): Promise<void> {
		if (!mentionedIds.length) return;
		const existing = await this.links.find({
			select: { entityId: true },
			where: { documentId, entity: BaseEntityEnum.Document, entityId: In(mentionedIds), tenantId: scope.tenantId, organizationId: scope.organizationId }
		});
		const have = new Set(existing.map((link) => String(link.entityId)));
		for (const entityId of new Set(mentionedIds)) {
			if (have.has(String(entityId))) continue;
			await this.links.save(
				this.links.create({
					tenantId: scope.tenantId,
					organizationId: scope.organizationId,
					documentId,
					entity: BaseEntityEnum.Document,
					entityId,
					metadata: jsonColumn({ origin: 'editor-mention' })
				} as Partial<DocumentLink> as DocumentLink)
			);
		}
	}

	async usedBytes(scope: IImportScope): Promise<number> {
		return this.quota.getUsedBytes(scope.organizationId);
	}

	/** The owner and the export's created date, written past the listeners that would stamp the (absent) request user. */
	private async stamp(id: ID, ownerUserId: ID | null, createdAt?: Date): Promise<void> {
		const set: Record<string, unknown> = {};
		if (ownerUserId) {
			set['createdByUserId'] = ownerUserId;
			set['updatedByUserId'] = ownerUserId;
		}
		if (createdAt) set['createdAt'] = createdAt;
		if (!Object.keys(set).length) return;
		await this.documents.createQueryBuilder().update(Document).set(set as never).where({ id }).callListeners(false).execute();
	}
}

