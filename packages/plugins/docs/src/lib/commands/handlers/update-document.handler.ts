import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { UpdateDocumentCommand } from '../update-document.command';

@CommandHandler(UpdateDocumentCommand)
export class UpdateDocumentHandler implements ICommandHandler<UpdateDocumentCommand> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `UpdateDocumentCommand`: partial metadata-only update.
	 *
	 * @param command - The command carrying the id and update payload.
	 * @returns The updated document.
	 */
	public async execute(command: UpdateDocumentCommand): Promise<IDocument> {
		return this.documentService.updateDocument(command.id, command.input);
	}
}
