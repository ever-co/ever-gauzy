import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { MoveDocumentCommand } from '../move-document.command';

@CommandHandler(MoveDocumentCommand)
export class MoveDocumentHandler implements ICommandHandler<MoveDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `MoveDocumentCommand`: re-parents a node (cycle-guarded) and compacts the
	 * sibling `index` values.
	 *
	 * @param command - The command carrying the id and move payload.
	 * @returns The moved document.
	 */
	public async execute(command: MoveDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		const moved = await this.documentTreeService.moveDocument(document, command.input.parentId, command.input.index);
		this.documentService.emitDocumentEvent(moved, 'updated');
		return moved;
	}
}
