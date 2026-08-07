import { ForbiddenException, HttpException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID, ITag, IDocumentCategory, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DOCS_BULK_ACTION_UNSUPPORTED } from '../../docs.constants';
import { DocumentBulkActionEnum, IDocumentBulkResult, IDocumentBulkResultItem } from '../../dto/bulk-action.dto';
import { DocumentService } from '../../services/document.service';
import { DocumentKnowledgeService } from '../../services/document-knowledge.service';
import { DocumentReviewService } from '../../services/document-review.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { BulkDocumentActionCommand } from '../bulk-document-action.command';

@CommandHandler(BulkDocumentActionCommand)
export class BulkDocumentActionHandler implements ICommandHandler<BulkDocumentActionCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService,
		private readonly documentKnowledgeService: DocumentKnowledgeService,
		private readonly documentReviewService: DocumentReviewService
	) {}

	/**
	 * Handles the `BulkDocumentActionCommand` with per-id partial failure (one HTTP 200).
	 *
	 * Per-action permission enforcement (the route guard only checks the any-of set):
	 * `REVIEW_APPROVE`/`REVIEW_REJECT` require `DOCS_REVIEW` only; every other action requires
	 * `DOCS_MANAGE` as base, with escalations: `DELETE` also requires `DOCS_DELETE`;
	 * `KNOWLEDGE_IMPORT`/`KNOWLEDGE_EXCLUDE` also require `DOCS_AI_IMPORT` — missing → 403
	 * before any work.
	 *
	 * @param command - The command carrying the bulk payload.
	 * @returns The per-id result envelope.
	 */
	public async execute(command: BulkDocumentActionCommand): Promise<IDocumentBulkResult> {
		const { input } = command;
		this.assertActionPermissions(input.action);

		const results: IDocumentBulkResultItem[] = [];
		for (const id of input.ids) {
			try {
				await this.applyAction(id, command);
				results.push({ id, ok: true });
			} catch (error) {
				results.push({ id, ok: false, code: this.errorCode(error) });
			}
		}

		const succeeded = results.filter((result) => result.ok).length;
		return {
			requested: input.ids.length,
			succeeded,
			failed: results.length - succeeded,
			results
		};
	}

	/**
	 * Enforces the per-action permission matrix; violations raise 403 before any mutation.
	 */
	private assertActionPermissions(action: DocumentBulkActionEnum): void {
		const isReviewAction = [DocumentBulkActionEnum.REVIEW_APPROVE, DocumentBulkActionEnum.REVIEW_REJECT].includes(
			action
		);
		if (isReviewAction) {
			if (!RequestContext.hasPermission(PermissionsEnum.DOCS_REVIEW)) {
				throw new ForbiddenException('Bulk review actions require the DOCS_REVIEW permission');
			}
			return;
		}
		if (!RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE)) {
			throw new ForbiddenException('Bulk actions require the DOCS_MANAGE permission');
		}
		if (action === DocumentBulkActionEnum.DELETE && !RequestContext.hasPermission(PermissionsEnum.DOCS_DELETE)) {
			throw new ForbiddenException('Bulk delete requires the DOCS_DELETE permission');
		}
		if (
			[DocumentBulkActionEnum.KNOWLEDGE_IMPORT, DocumentBulkActionEnum.KNOWLEDGE_EXCLUDE].includes(action) &&
			!RequestContext.hasPermission(PermissionsEnum.DOCS_AI_IMPORT)
		) {
			throw new ForbiddenException('Bulk knowledge actions require the DOCS_AI_IMPORT permission');
		}
	}

	/**
	 * Applies one action to one id (per-id failures are collected by the caller).
	 */
	private async applyAction(id: ID, command: BulkDocumentActionCommand): Promise<void> {
		const { action, categoryIds, tagIds, parentId, reason } = command.input;

		switch (action) {
			case DocumentBulkActionEnum.ARCHIVE: {
				const document = await this.documentService.findOneScoped(id);
				await this.documentTreeService.archiveSubtree(document); // idempotent-success
				return;
			}
			case DocumentBulkActionEnum.UNARCHIVE: {
				const document = await this.documentService.findOneScoped(id);
				await this.documentTreeService.unarchiveSubtree(document); // idempotent-success
				return;
			}
			case DocumentBulkActionEnum.SET_CATEGORIES: {
				const document = await this.documentService.findOneScoped(id, ['categories']);
				document.categories = (categoryIds ?? []).map((categoryId: ID) => ({ id: categoryId })) as IDocumentCategory[];
				await this.documentService.save(document);
				return;
			}
			case DocumentBulkActionEnum.ADD_TAGS: {
				const document = await this.documentService.findOneScoped(id, ['tags']);
				const existing = new Set((document.tags ?? []).map((tag: ITag) => tag.id));
				const additions = (tagIds ?? []).filter((tagId: ID) => !existing.has(tagId));
				document.tags = [...(document.tags ?? []), ...additions.map((tagId: ID) => ({ id: tagId }) as ITag)];
				await this.documentService.save(document);
				return;
			}
			case DocumentBulkActionEnum.REMOVE_TAGS: {
				const document = await this.documentService.findOneScoped(id, ['tags']);
				const removals = new Set(tagIds ?? []);
				document.tags = (document.tags ?? []).filter((tag: ITag) => !removals.has(tag.id));
				await this.documentService.save(document);
				return;
			}
			case DocumentBulkActionEnum.MOVE: {
				const document = await this.documentService.findOneScoped(id);
				await this.documentTreeService.moveDocument(document, parentId ?? null);
				return;
			}
			case DocumentBulkActionEnum.DELETE: {
				const document = await this.documentService.findOneScoped(id);
				const deleted = await this.documentTreeService.deleteDocument(document, 'subtree');
				this.documentService.emitDocumentEvent(deleted, 'deleted');
				return;
			}
			case DocumentBulkActionEnum.KNOWLEDGE_IMPORT: {
				await this.documentKnowledgeService.importToKnowledge(id);
				return;
			}
			case DocumentBulkActionEnum.KNOWLEDGE_EXCLUDE: {
				await this.documentKnowledgeService.excludeFromKnowledge(id);
				return;
			}
			case DocumentBulkActionEnum.REVIEW_APPROVE: {
				// The §4.9 review state machine per id — non-PENDING ids fail with
				// DOCS_REVIEW_NOT_PENDING and are collected by the caller.
				await this.documentReviewService.approve(id);
				return;
			}
			case DocumentBulkActionEnum.REVIEW_REJECT: {
				await this.documentReviewService.reject(id, { reason });
				return;
			}
			default:
				throw new HttpException({ code: DOCS_BULK_ACTION_UNSUPPORTED }, 400);
		}
	}

	/**
	 * Extracts the stable `DOCS_*` code from a thrown exception (falls back to the exception name).
	 */
	private errorCode(error: any): string {
		const response = error?.getResponse?.();
		if (response && typeof response === 'object' && response.code) {
			return response.code;
		}
		return error?.name ?? 'DOCS_BULK_ITEM_FAILED';
	}
}
