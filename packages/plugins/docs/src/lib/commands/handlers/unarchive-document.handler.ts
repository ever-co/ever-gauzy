import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { UnarchiveDocumentCommand } from '../unarchive-document.command';

@CommandHandler(UnarchiveDocumentCommand)
export class UnarchiveDocumentHandler implements ICommandHandler<UnarchiveDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `UnarchiveDocumentCommand`: clears the archive flags on the subtree (plus any
	 * archived ancestors needed for reachability). Idempotent.
	 *
	 * @param command - The command carrying the id.
	 * @returns The unarchived document.
	 */
	public async execute(command: UnarchiveDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		await this.documentService.assertCanWrite(document);
		const wasArchived = document.isArchived === true;
		await this.documentTreeService.unarchiveSubtree(document);
		const unarchived = await this.documentService.findOneScoped(command.id);
		// `field` + before/after so the activity timeline records the unarchive (R-COL-03).
		this.documentService.emitDocumentEvent(unarchived, 'updated', {
			phase: 'crud',
			field: 'isArchived',
			previous: String(wasArchived),
			next: String(unarchived.isArchived === true)
		});
		return unarchived;
	}
}
