import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { ArchiveDocumentCommand } from '../archive-document.command';

@CommandHandler(ArchiveDocumentCommand)
export class ArchiveDocumentHandler implements ICommandHandler<ArchiveDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService
	) {}

	/**
	 * Handles the `ArchiveDocumentCommand`: archives the node and cascades to the whole
	 * subtree. Idempotent.
	 *
	 * @param command - The command carrying the id.
	 * @returns The archived document.
	 */
	public async execute(command: ArchiveDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		await this.documentService.assertCanWrite(document);
		const wasArchived = document.isArchived === true;
		await this.documentTreeService.archiveSubtree(document);
		const archived = await this.documentService.findOneScoped(command.id);
		// `field` + before/after so the activity timeline records the archive (R-COL-03).
		this.documentService.emitDocumentEvent(archived, 'updated', {
			phase: 'crud',
			field: 'isArchived',
			previous: String(wasArchived),
			next: String(archived.isArchived === true)
		});
		return archived;
	}
}
