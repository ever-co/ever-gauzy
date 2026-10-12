import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { DocumentProcessingService } from '../../services/document-processing.service';
import { ReprocessDocumentCommand } from '../reprocess-document.command';

@CommandHandler(ReprocessDocumentCommand)
export class ReprocessDocumentHandler implements ICommandHandler<ReprocessDocumentCommand> {
	constructor(private readonly documentProcessingService: DocumentProcessingService) {}

	/**
	 * Handles the `ReprocessDocumentCommand`: re-runs the pipeline from `docs.extract`
	 * for a FILE document (409 when a human-edited extraction would be overwritten).
	 *
	 * @param command - The command carrying the document id and reprocess options.
	 * @returns The document after the enqueue.
	 */
	public async execute(command: ReprocessDocumentCommand): Promise<IDocument> {
		return this.documentProcessingService.reprocess(command.id, command.input);
	}
}
