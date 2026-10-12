import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentLink } from '@gauzy/contracts';
import { DocumentLinkService } from '../../services/document-link.service';
import { DeleteDocumentLinkCommand } from '../delete-document-link.command';

@CommandHandler(DeleteDocumentLinkCommand)
export class DeleteDocumentLinkHandler implements ICommandHandler<DeleteDocumentLinkCommand> {
	constructor(private readonly documentLinkService: DocumentLinkService) {}

	/**
	 * Handles the `DeleteDocumentLinkCommand`: soft-deletes a link.
	 *
	 * @param command - The command carrying the id.
	 * @returns The soft-deleted link.
	 */
	public async execute(command: DeleteDocumentLinkCommand): Promise<IDocumentLink> {
		return this.documentLinkService.deleteLink(command.id);
	}
}
