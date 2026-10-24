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
		await this.documentService.assertCanWrite(document);
		// The new parent is read through the scope a create reads it through: the tree's own lookup checks only
		// the organization, so a writer could move a document into another member's PRIVATE folder by its id.
		// And it must be writable, as a duplicate's target is: the move adds to its children and renumbers them, so a
		// VIEW/COMMENT grantee could otherwise file documents into a folder they may only read.
		if (command.input.parentId) {
			const parent = await this.documentService.findOneScoped(
				command.input.parentId,
				[],
				document.organizationId
			);
			await this.documentService.assertCanWrite(parent);
		}
		const previousParentId = document.parentId ?? null;
		const moved = await this.documentTreeService.moveDocument(document, command.input.parentId, command.input.index);
		// `field` + before/after so the activity timeline records the re-parenting (R-COL-03),
		// not just "the document was updated".
		this.documentService.emitDocumentEvent(moved, 'updated', {
			phase: 'crud',
			field: 'parentId',
			previous: previousParentId ?? 'root',
			next: moved.parentId ?? 'root'
		});
		return moved;
	}
}
