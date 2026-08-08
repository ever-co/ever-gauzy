import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { CreateDocumentCommand } from '../create-document.command';

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler implements ICommandHandler<CreateDocumentCommand> {
	constructor(private readonly documentService: DocumentService) {}

	/**
	 * Handles the `CreateDocumentCommand`: creates a FOLDER or PAGE node.
	 *
	 * @param command - The command carrying the create payload.
	 * @returns The newly created document.
	 */
	public async execute(command: CreateDocumentCommand): Promise<IDocument> {
		return this.documentService.createDocument(command.input);
	}
}
