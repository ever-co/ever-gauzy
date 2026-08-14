import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { UpdateDocumentContentCommand } from '../update-document-content.command';

@CommandHandler(UpdateDocumentContentCommand)
export class UpdateDocumentContentHandler implements ICommandHandler<UpdateDocumentContentCommand> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `UpdateDocumentContentCommand`: PAGE content save with optimistic concurrency
	 * (409), lock enforcement (423), debounced version snapshot, and mention diff-sync.
	 *
	 * @param command - The command carrying the id and content payload.
	 * @returns The updated document.
	 */
	public async execute(command: UpdateDocumentContentCommand): Promise<IDocument> {
		return this.documentService.updateContent(command.id, command.input);
	}
}
