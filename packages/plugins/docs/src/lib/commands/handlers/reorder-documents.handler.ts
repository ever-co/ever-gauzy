import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { ReorderDocumentsCommand } from '../reorder-documents.command';

@CommandHandler(ReorderDocumentsCommand)
export class ReorderDocumentsHandler implements ICommandHandler<ReorderDocumentsCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `ReorderDocumentsCommand`: rewrites `index` for the listed siblings.
	 *
	 * The parent folder is read through the caller's scope, so a folder the caller cannot see answers the same 404
	 * as one that does not exist: before, a hidden folder reordered (its children's ids were accepted) where a
	 * missing one answered 400, which told the two apart. A sibling the caller cannot see is refused like an id that
	 * is no sibling, and the organization is required, as every other document read requires it.
	 *
	 * @param command - The command carrying the parent and ordered sibling ids.
	 */
	public async execute(command: ReorderDocumentsCommand): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.documentService.resolveOrganizationId();
		if (command.input.parentId) {
			await this.documentService.findOneScoped(command.input.parentId, [], organizationId);
		}
		await this.documentTreeService.reorderDocuments(
			command.input.parentId,
			command.input.orderedIds,
			tenantId,
			organizationId,
			(ids) => this.documentService.filterReadableDocumentIds(ids, organizationId)
		);
	}
}
