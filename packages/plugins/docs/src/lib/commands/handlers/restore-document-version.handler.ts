import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentService } from '../../services/document.service';
import { DocumentVersionService } from '../../services/document-version.service';
import { RestoreDocumentVersionCommand } from '../restore-document-version.command';

@CommandHandler(RestoreDocumentVersionCommand)
export class RestoreDocumentVersionHandler implements ICommandHandler<RestoreDocumentVersionCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentVersionService: DocumentVersionService
	) {}

	/**
	 * Handles the `RestoreDocumentVersionCommand`: **non-destructive** restore — first snapshots
	 * the current content as a new version, then copies the target snapshot onto the document.
	 *
	 * @param command - The command carrying the document and version ids.
	 * @returns The updated document.
	 */
	public async execute(command: RestoreDocumentVersionCommand): Promise<IDocument> {
		const document = await this.documentService.findOneScoped(command.id);
		const restored = await this.documentVersionService.restoreVersion(document, command.versionId);
		this.documentService.emitDocumentEvent(restored, 'updated');
		return restored;
	}
}
