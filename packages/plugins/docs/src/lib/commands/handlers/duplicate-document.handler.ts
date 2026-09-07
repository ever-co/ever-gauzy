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
	 * Reading the source needs read access only, but writing the copy **into** a target parent
	 * is a mutation of that parent's subtree — so an explicit `parentId` is resolved through
	 * the read scope and must additionally be writable by the caller.
	 *
	 * @param command - The command carrying the id and duplicate options.
	 * @returns The new root node of the copy.
	 */
	public async execute(command: DuplicateDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);

		if (command.input?.parentId) {
			const parent = await this.documentService.findOneScoped(command.input.parentId);
			await this.documentService.assertCanWrite(parent);
		}

		const copy = await this.documentTreeService.duplicateDocument(document, command.input);
		this.documentService.emitDocumentEvent(copy, 'created');
		return copy;
	}
}
