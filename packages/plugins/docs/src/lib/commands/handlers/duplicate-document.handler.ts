import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { DuplicateDocumentCommand } from '../duplicate-document.command';

@CommandHandler(DuplicateDocumentCommand)
export class DuplicateDocumentHandler implements ICommandHandler<DuplicateDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `DuplicateDocumentCommand`: copies a node (optionally its subtree); the copy
	 * starts `knowledgeStatus: NONE`, `reviewStatus: NONE`.
	 *
	 * @param command - The command carrying the id and duplicate options.
	 * @returns The new root node of the copy.
	 */
	public async execute(command: DuplicateDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		const copy = await this.documentTreeService.duplicateDocument(document, command.input);
		this.documentService.emitDocumentEvent(copy, 'created');
		return copy;
	}
}
