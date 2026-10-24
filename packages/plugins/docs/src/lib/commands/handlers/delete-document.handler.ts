import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { DeleteDocumentCommand } from '../delete-document.command';

@CommandHandler(DeleteDocumentCommand)
export class DeleteDocumentHandler implements ICommandHandler<DeleteDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `DeleteDocumentCommand`: soft delete, allowed only from archived state
	 * (archive-first workflow), with `subtree` or `promote-children` strategy. A `subtree` delete
	 * takes the descendants the caller may read: the others are neither named nor deleted.
	 *
	 * @param command - The command carrying the id and strategy.
	 * @returns The soft-deleted document.
	 */
	public async execute(command: DeleteDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		await this.documentService.assertCanWrite(document);
		const deleted = await this.documentTreeService.deleteDocument(document, command.strategy, (ids) =>
			this.documentService.filterReadableDocumentIds(ids, document.organizationId)
		);
		this.documentService.emitDocumentEvent(deleted, 'deleted');
		return deleted;
	}
}
