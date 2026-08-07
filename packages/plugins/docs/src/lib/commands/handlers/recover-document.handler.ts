import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { RecoverDocumentCommand } from '../recover-document.command';

@CommandHandler(RecoverDocumentCommand)
export class RecoverDocumentHandler implements ICommandHandler<RecoverDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `RecoverDocumentCommand`: restores a soft-deleted document (re-parented to
	 * root if the original parent is still deleted); the document returns in archived state.
	 *
	 * @param command - The command carrying the id.
	 * @returns The recovered document.
	 */
	public async execute(command: RecoverDocumentCommand): Promise<IDocument> {
		const tenantId = RequestContext.currentTenantId();
		const recovered = await this.documentTreeService.recoverDocument(command.id, tenantId);
		this.documentService.emitDocumentEvent(recovered, 'updated');
		return recovered;
	}
}
