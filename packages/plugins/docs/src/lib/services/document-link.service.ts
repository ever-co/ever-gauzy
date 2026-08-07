import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEnum, ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { CreateDocumentLinkDTO } from '../dto';
import { DocumentLink } from '../entities/document-link.entity';
import { MikroOrmDocumentLinkRepository } from '../repositories/mikro-orm-document-link.repository';
import { TypeOrmDocumentLinkRepository } from '../repositories/type-orm-document-link.repository';

@Injectable()
export class DocumentLinkService extends TenantAwareCrudService<DocumentLink> {
	private readonly logger = new Logger(DocumentLinkService.name);

	constructor(
		public readonly typeOrmDocumentLinkRepository: TypeOrmDocumentLinkRepository,
		public readonly mikroOrmDocumentLinkRepository: MikroOrmDocumentLinkRepository
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
	 * The "Documents panel" reverse lookup: every link attached to one business record,
	 * with the document relation loaded.
	 *
	 * @param entity The target record type.
	 * @param entityId The target record id.
	 * @param organizationId Organization scope.
	 * @returns The matching links.
	 */
	async getLinksForEntity(entity: BaseEntityEnum, entityId: ID, organizationId?: ID): Promise<IPagination<DocumentLink>> {
		const tenantId = RequestContext.currentTenantId();
		const result = await this.findAll({
			where: {
				tenantId,
				...(organizationId && { organizationId }),
				entity,
				entityId
			},
			relations: ['document']
		});
		return { items: result.items.map((item) => this.withParsedMetadata(item)), total: result.total };
	}

	/**
	 * Forward lookup: everything one document is attached to.
	 *
	 * @param documentId The document id.
	 * @returns The matching links.
	 */
	async getLinksForDocument(documentId: ID): Promise<IPagination<DocumentLink>> {
		const tenantId = RequestContext.currentTenantId();
		const result = await this.findAll({ where: { tenantId, documentId } });
		return { items: result.items.map((item) => this.withParsedMetadata(item)), total: result.total };
	}

	/**
	 * Soft-deletes a link.
	 *
	 * @param id The link id.
	 * @returns The soft-deleted link.
	 */
	async deleteLink(id: ID): Promise<DocumentLink> {
		const link = await this.findOneByIdString(id);
		if (!link) {
			throw new NotFoundException(`Document link ${id} was not found`);
		}
		await this.softDelete(id);
		return link;
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
