import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { DocumentTreeService } from '../../services/document-tree.service';
import { ReorderDocumentsCommand } from '../reorder-documents.command';

@CommandHandler(ReorderDocumentsCommand)
export class ReorderDocumentsHandler implements ICommandHandler<ReorderDocumentsCommand> {
	constructor(private readonly documentTreeService: DocumentTreeService) {}

	/**
	 * Handles the `ReorderDocumentsCommand`: rewrites `index` for the listed siblings.
	 *
	 * @param command - The command carrying the parent and ordered sibling ids.
	 */
	public async execute(command: ReorderDocumentsCommand): Promise<void> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		await this.documentTreeService.reorderDocuments(
			command.input.parentId,
			command.input.orderedIds,
			tenantId,
			organizationId
		);
	}
}
