import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
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
	 * The trashed row is resolved through the full read scope first (tenant + organization +
	 * visibility/ownership/share), so an id from another organization — or someone else's
	 * PRIVATE document — is a 404 and is never un-deleted or returned.
	 *
	 * @param command - The command carrying the id.
	 * @returns The recovered document.
	 */
	public async execute(command: RecoverDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneDeletedScoped(command.id);
		await this.documentService.assertCanWrite(document);

		const recovered = await this.documentTreeService.recoverDocument(document);
		this.documentService.emitDocumentEvent(recovered, 'updated');
		return recovered;
	}
}
