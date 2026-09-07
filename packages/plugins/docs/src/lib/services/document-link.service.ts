import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEnum, ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, prepareSQLQuery as p } from '@gauzy/core';
import { CreateDocumentLinkDTO } from '../dto';
import { DocumentLink } from '../entities/document-link.entity';
import { MikroOrmDocumentLinkRepository } from '../repositories/mikro-orm-document-link.repository';
import { TypeOrmDocumentLinkRepository } from '../repositories/type-orm-document-link.repository';
import { DOCUMENT_LIST_COLUMNS, DocumentService } from './document.service';

@Injectable()
export class DocumentLinkService extends TenantAwareCrudService<DocumentLink> {
	private readonly logger = new Logger(DocumentLinkService.name);

	constructor(
		public readonly typeOrmDocumentLinkRepository: TypeOrmDocumentLinkRepository,
		public readonly mikroOrmDocumentLinkRepository: MikroOrmDocumentLinkRepository,
		private readonly documentService: DocumentService
	) {
		super(typeOrmDocumentLinkRepository, mikroOrmDocumentLinkRepository);
	}

	/**
	 * Idempotent link write on `(documentId, entity, entityId)` — a duplicate returns the
	 * existing row.
	 *
	 * @param input The link payload.
	 * @returns The created (or pre-existing) link.
	 */
	async createLink(input: CreateDocumentLinkDTO): Promise<DocumentLink> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId, documentId, entity, entityId } = input;

		const existing = await this.typeOrmDocumentLinkRepository.findOne({
			where: { tenantId, organizationId, documentId, entity, entityId }
		});
		if (existing) {
			return this.withParsedMetadata(existing);
		}

		const link = await this.create({
			tenantId,
			organizationId,
			documentId,
			entity,
			entityId,
			metadata: this.serializeMetadata(input.metadata)
		});
		return this.withParsedMetadata(link);
	}

	/**
	 * The "Documents panel" reverse lookup: every link attached to one business record, with a
	 * **list-safe** projection of the document relation.
	 *
	 * The link rows are only as private as the documents behind them, so the joined document is
	 * put through the exact same gate as the document list itself: organization scope on both
	 * sides of the join plus `DocumentService.applyVisibilityScope()` (visibility OR ownership
	 * OR `DOCS_MANAGE` OR a share grant). Content columns (`contentJson`, `contentHtml`,
	 * `extractedText`, `contentBinary`) and the storage key are never projected here — the
	 * panel needs metadata, and `fileUrl` is resolved from `storageKey` by the subscriber, so
	 * withholding the column withholds the URL too.
	 *
	 * @param entity The target record type.
	 * @param entityId The target record id.
	 * @param organizationId Organization scope (falls back to the requester's current org).
	 * @returns The matching links.
	 */
	async getLinksForEntity(
		entity: BaseEntityEnum,
		entityId: ID,
		organizationId?: ID
	): Promise<IPagination<DocumentLink>> {
		const qb = this.buildScopedLinkQuery(organizationId);
		qb.andWhere(p(`"document_link"."entity" = :entity`), { entity });
		qb.andWhere(p(`"document_link"."entityId" = :entityId`), { entityId });

		const [items, total] = await qb.getManyAndCount();
		return { items: items.map((item) => this.withParsedMetadata(item)), total };
	}

	/**
	 * Forward lookup: everything one document is attached to.
	 *
	 * The document itself is resolved through the read scope first — otherwise the mere
	 * *existence* (and count) of links and attachments on someone else's PRIVATE document, or
	 * on another organization's document, would leak through this endpoint.
	 *
	 * @param documentId The document id.
	 * @param organizationId Explicit organization scope for the document read (falls back to the
	 * requester's current organization when omitted).
	 * @returns The matching links.
	 */
	async getLinksForDocument(documentId: ID, organizationId?: ID): Promise<IPagination<DocumentLink>> {
		const document = await this.documentService.findOneScoped(documentId, [], organizationId);

		const qb = this.buildScopedLinkQuery(document.organizationId);
		qb.andWhere(p(`"document_link"."documentId" = :documentId`), { documentId });

		const [items, total] = await qb.getManyAndCount();
		return { items: items.map((item) => this.withParsedMetadata(item)), total };
	}

	/**
	 * Soft-deletes a link.
	 *
	 * @param id The link id.
	 * @returns The soft-deleted link.
	 */
	async deleteLink(id: ID): Promise<DocumentLink> {
		// Tenant + organization, like every other link path — the inherited `findOneByIdString`
		// merges the tenant only, which would let one organization detach another's links.
		const link = await this.typeOrmDocumentLinkRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: this.documentService.resolveOrganizationId()
			}
		});
		if (!link) {
			throw new NotFoundException(`Document link ${id} was not found`);
		}
		await this.softDelete(id);
		return link;
	}

	/**
	 * Builds the shared, fully-scoped link query: tenant + organization on the link row, an
	 * `INNER JOIN` to the document (so a link whose document is out of scope disappears
	 * entirely), the same organization scope on the joined document, the visibility/share
	 * predicate, and the list-safe document projection.
	 *
	 * @param organizationId Organization scope (falls back to the requester's current org).
	 * @returns The scoped query builder.
	 */
	private buildScopedLinkQuery(organizationId?: ID): SelectQueryBuilder<DocumentLink> {
		const tenantId = RequestContext.currentTenantId();
		const scopedOrganizationId = this.documentService.resolveOrganizationId({ organizationId });

		const qb = this.typeOrmDocumentLinkRepository.createQueryBuilder('document_link');
		qb.innerJoin('document_link.document', 'document');
		qb.addSelect(DOCUMENT_LIST_COLUMNS.map((column: string) => `document.${column}`));

		qb.where(p(`"document_link"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"document_link"."organizationId" = :organizationId`), {
			organizationId: scopedOrganizationId
		});
		// The join partner is scoped independently — a link row may not drag a foreign
		// organization's document into the response even if the link row itself is in scope.
		qb.andWhere(p(`"document"."organizationId" = :organizationId`));
		qb.andWhere(p(`"document"."tenantId" = :tenantId`));

		this.documentService.applyVisibilityScope(qb, 'document');
		qb.orderBy('document_link.createdAt', 'DESC');

		return qb;
	}

	/**
	 * Serializes the metadata JSON for persistence on the SQLite path (the plain-text `json`
	 * column) — per spec, this entity has no subscriber, the owning service round-trips.
	 */
	private serializeMetadata(value: any): any {
		if (value && typeof value === 'object' && (isSqlite() || isBetterSqlite3())) {
			try {
				return JSON.stringify(value);
			} catch (error) {
				this.logger.error('Error serializing link metadata:', (error as Error).message);
				return null;
			}
		}
		return value ?? null;
	}

	/**
	 * Parses metadata back into an object on the SQLite path.
	 */
	private withParsedMetadata(link: DocumentLink): DocumentLink {
		if (link?.metadata && typeof link.metadata === 'string' && (isSqlite() || isBetterSqlite3())) {
			try {
				link.metadata = JSON.parse(link.metadata);
			} catch {
				// Leave as-is — a malformed value must never break the read path
			}
		}
		return link;
	}
}
