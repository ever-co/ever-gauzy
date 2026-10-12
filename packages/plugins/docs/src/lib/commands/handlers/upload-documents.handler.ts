import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentUploadResponse } from '../../dto';
import { DocumentUploadService } from '../../services/document-upload.service';
import { UploadDocumentsCommand } from '../upload-documents.command';

@CommandHandler(UploadDocumentsCommand)
export class UploadDocumentsHandler implements ICommandHandler<UploadDocumentsCommand> {
	constructor(private readonly documentUploadService: DocumentUploadService) {}

	/**
	 * Handles the `UploadDocumentsCommand`: runs the per-file validation gauntlet and
	 * fans out one `Document` row + `docs.extract` job per accepted file.
	 *
	 * @param command - The command carrying the form fields and provider-mapped files.
	 * @returns The per-file accept/reject envelope.
	 */
	public async execute(command: UploadDocumentsCommand): Promise<IDocumentUploadResponse> {
		return this.documentUploadService.uploadDocuments(command.input, command.files);
	}
}
