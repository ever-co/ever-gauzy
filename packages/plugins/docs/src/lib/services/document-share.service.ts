import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DocumentVisibilityEnum, ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { DOCS_SHARE_EXISTS, DOCS_SHARE_FORBIDDEN, DOCS_SHARE_NOT_PRIVATE, DOCS_SHARE_TARGET } from '../docs.constants';
import { CreateDocumentShareDTO, UpdateDocumentShareDTO } from '../dto/document-share.dto';
import { DocumentShare } from '../entities/document-share.entity';
import { MikroOrmDocumentShareRepository } from '../repositories/mikro-orm-document-share.repository';
import { TypeOrmDocumentShareRepository } from '../repositories/type-orm-document-share.repository';
import { DocumentAccessService } from './document-access.service';
import { DocumentService } from './document.service';

/**
 * CRUD for the `DocumentShare` overlay (`03-backend-plugin.md` §4.12,
 * `08-permissions-security.md` §3.3).
 *
 * Rules enforced here — the route guard only proves the verb (`DOCS_READ` / `DOCS_UPDATE`):
 *
 * - The target document must be **readable** by the caller, else 404 (no existence oracle) —
 *   `DocumentService.findOneScoped` does that, share overlay included.
 * - Only the document's **creator** or a **`DOCS_MANAGE`** holder may list or mutate the
 *   overlay (403 `DOCS_SHARE_FORBIDDEN`). A grantee — even at `EDIT` — can never re-share.
 * - Shares are meaningful on `visibility: PRIVATE` documents only → 409
 *   `DOCS_SHARE_NOT_PRIVATE` on an ORGANIZATION document.
 * - Exactly one of `employeeId` / `teamId` → 400 `DOCS_SHARE_TARGET`.
 * - One row per (document, target) → 409 `DOCS_SHARE_EXISTS`.
 */
@Injectable()
export class DocumentShareService extends TenantAwareCrudService<DocumentShare> {
	private readonly logger = new Logger(DocumentShareService.name);

	constructor(
		public readonly typeOrmDocumentShareRepository: TypeOrmDocumentShareRepository,
		public readonly mikroOrmDocumentShareRepository: MikroOrmDocumentShareRepository,
		private readonly documentService: DocumentService,
		private readonly documentAccessService: DocumentAccessService
	) {
		super(typeOrmDocumentShareRepository, mikroOrmDocumentShareRepository);
	}

	/**
	 * Lists the share overlay of one document.
	 *
	 * @param documentId The document whose overlay to read.
	 * @returns The share rows with their employee/team relations.
	 */
	async findAllForDocument(documentId: ID): Promise<IPagination<DocumentShare>> {
		await this.assertCanAdminister(documentId);

		const [items, total] = await this.typeOrmDocumentShareRepository.findAndCount({
			where: { documentId, tenantId: RequestContext.currentTenantId() },
			relations: { employee: true, team: true },
			order: { createdAt: 'ASC' }
		});
		return { items, total };
	}

	/**
	 * Creates one share row.
	 *
	 * @param documentId The (PRIVATE) document to share.
	 * @param input The grantee + access level.
	 * @returns The created share row.
	 */
	async createShare(documentId: ID, input: CreateDocumentShareDTO): Promise<DocumentShare> {
		const document = await this.assertCanAdminister(documentId);

		// XOR target — both or neither is a 400 (mirrors CHK_document_share_target_xor).
		const hasEmployee = !!input.employeeId;
		const hasTeam = !!input.teamId;
		if (hasEmployee === hasTeam) {
			throw new BadRequestException({
				message: 'Exactly one of employeeId / teamId must be provided',
				code: DOCS_SHARE_TARGET
			});
		}

		// The overlay is additive on PRIVATE documents only (08 §3.3) — sharing an
		// ORGANIZATION document would be a silent no-op, so it is refused loudly.
		if (document.visibility !== DocumentVisibilityEnum.PRIVATE) {
			throw new ConflictException({
				message: 'Shares apply to PRIVATE documents only',
				code: DOCS_SHARE_NOT_PRIVATE
			});
		}

		const tenantId = RequestContext.currentTenantId();
		const duplicate = await this.typeOrmDocumentShareRepository.findOne({
			where: {
				documentId,
				tenantId,
				employeeId: hasEmployee ? input.employeeId : IsNull(),
				teamId: hasTeam ? input.teamId : IsNull()
			}
		});
		if (duplicate) {
			throw new ConflictException({
				message: 'This document is already shared with that target',
				code: DOCS_SHARE_EXISTS
			});
		}

		const share = await this.create({
			documentId,
			organizationId: document.organizationId,
			employeeId: hasEmployee ? input.employeeId : null,
			teamId: hasTeam ? input.teamId : null,
			access: input.access
		} as any);

		this.logger.debug(`Document ${documentId} shared (${input.access}) with ${hasEmployee ? 'employee' : 'team'}.`);
		return share;
	}

	/**
	 * Updates the access level of one share row.
	 *
	 * @param documentId The document owning the row.
	 * @param shareId The share row id.
	 * @param input The new access level.
	 * @returns The updated share row.
	 */
	async updateShare(documentId: ID, shareId: ID, input: UpdateDocumentShareDTO): Promise<DocumentShare> {
		await this.assertCanAdminister(documentId);
		const share = await this.findShareOrFail(documentId, shareId);

		await this.typeOrmDocumentShareRepository.update(
			{ id: share.id, tenantId: RequestContext.currentTenantId() },
			{ access: input.access }
		);
		return this.findShareOrFail(documentId, shareId);
	}

	/**
	 * Revokes one share row (soft delete — the affected row is returned, per the plugin's
	 * "no 204s" convention).
	 *
	 * @param documentId The document owning the row.
	 * @param shareId The share row id.
	 * @returns The revoked share row.
	 */
	async deleteShare(documentId: ID, shareId: ID): Promise<DocumentShare> {
		await this.assertCanAdminister(documentId);
		const share = await this.findShareOrFail(documentId, shareId);

		await this.typeOrmDocumentShareRepository.softDelete({
			id: share.id,
			tenantId: RequestContext.currentTenantId()
		});
		return share;
	}

	/**
	 * Loads the target document through the read scope (404 when not readable) and asserts
	 * that the caller may administer its overlay (403 otherwise).
	 *
	 * @param documentId The document id.
	 * @returns The document.
	 */
	private async assertCanAdminister(documentId: ID) {
		// Not readable → 404 from findOneScoped; readable but not owned/managed → 403 below.
		const document = await this.documentService.findOneScoped(documentId);
		const permitted = await this.documentAccessService.canAdministerShares({
			createdByUserId: document.createdByUserId,
			visibility: document.visibility
		});
		if (!permitted) {
			throw new ForbiddenException({
				message: 'Only the document creator or a DOCS_MANAGE holder can manage its shares',
				code: DOCS_SHARE_FORBIDDEN
			});
		}
		return document;
	}

	/**
	 * Loads one share row scoped to its document (a share id from another document is a 404).
	 *
	 * @param documentId The owning document id.
	 * @param shareId The share row id.
	 * @returns The share row.
	 */
	private async findShareOrFail(documentId: ID, shareId: ID): Promise<DocumentShare> {
		const share = await this.typeOrmDocumentShareRepository.findOne({
			where: { id: shareId, documentId, tenantId: RequestContext.currentTenantId() },
			relations: { employee: true, team: true }
		});
		if (!share) {
			throw new NotFoundException(`Document share ${shareId} was not found`);
		}
		return share;
	}
}
