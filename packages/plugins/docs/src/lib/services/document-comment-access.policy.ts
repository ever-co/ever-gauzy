import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, DocumentShareAccessEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { CommentParentAccessPolicy, ICommentParent, ICommentParentAccessPolicy } from '@gauzy/core';
import { Document } from '../entities/document.entity';
import { isDocumentReadable } from './document-access.predicate';
import { DocumentAccessService } from './document-access.service';
import { DocumentService } from './document.service';

/**
 * Who may read and write the comments of a Docs page: the comments whose `entity` is `Document`.
 *
 * Without this policy the comment API kept a caller only inside their tenant, so the comments of a private page, a
 * team's page or a page shared with a few people could be read and written by anyone of the tenant who knew its id.
 * Now:
 *
 * - **Reading** them takes `DOCS_READ` and a page the caller may read, by the page's own read (`findOneScoped`: the
 *   caller's tenant and organization, its visibility, the team, the creator, `DOCS_MANAGE`, or a share).
 * - **Writing** them (posting, editing, withdrawing, removing) takes the same, except that a page the caller reaches
 *   only through a `VIEW` share stays read-only: commenting there needs a `COMMENT` (or `EDIT`) share, as the share
 *   levels say. A page readable without a share (an organization page, the caller's team's, their own) or one they may
 *   edit takes comments as before.
 *
 * A page the caller may not reach answers as a missing one, so a page of another organization or a private page of
 * someone else cannot be told from a missing id.
 */
@CommentParentAccessPolicy()
@Injectable()
export class DocumentCommentAccessPolicy implements ICommentParentAccessPolicy {
	readonly entity = BaseEntityEnum.Document;
	readonly readPermissions = [PermissionsEnum.DOCS_READ] as const;
	readonly writePermissions = [PermissionsEnum.DOCS_READ] as const;

	constructor(private readonly documentService: DocumentService, private readonly documentAccessService: DocumentAccessService) {}

	async findAccessibleParent(entityId: ID): Promise<ICommentParent | null> {
		const document = await this.readable(entityId);
		return document ? parentOf(document) : null;
	}

	async findWritableParent(entityId: ID): Promise<ICommentParent | null> {
		const document = await this.readable(entityId);
		if (!document) return null;
		const row = { createdByUserId: document.createdByUserId, visibility: document.visibility, organizationTeamId: document.organizationTeamId };
		// Readable without a share (organization page, the caller's team's, their own, a manager): comments as before.
		if (isDocumentReadable({ ...row, shares: [] }, await this.documentAccessService.currentSubject())) {
			return parentOf(document);
		}
		// Reached through a share: at least COMMENT, or a page the caller may edit.
		if (await this.documentAccessService.hasShareAtLeast(row, document.id as ID, DocumentShareAccessEnum.COMMENT)) {
			return parentOf(document);
		}
		return (await this.documentAccessService.canWrite(row, document.id as ID)) ? parentOf(document) : null;
	}

	/** The page by its own scoped read; null when the caller may not read it or it does not exist. */
	private async readable(entityId: ID): Promise<Document | null> {
		try {
			return await this.documentService.findOneScoped(entityId);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ForbiddenException) {
				return null;
			}
			throw error;
		}
	}
}

function parentOf(document: Document): ICommentParent {
	return { id: document.id as ID, organizationId: (document.organizationId as ID) ?? null };
}
