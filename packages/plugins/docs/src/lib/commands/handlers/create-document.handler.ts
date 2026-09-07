import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DocumentKindEnum, IDocument } from '@gauzy/contracts';
import { DocumentKnowledgeService } from '../../services/document-knowledge.service';
import { DocumentService } from '../../services/document.service';
import { DocumentSettingsService } from '../../services/document-settings.service';
import { CreateDocumentCommand } from '../create-document.command';

@CommandHandler(CreateDocumentCommand)
export class CreateDocumentHandler implements ICommandHandler<CreateDocumentCommand> {
	private readonly logger = new Logger(CreateDocumentHandler.name);

	constructor(
		private readonly documentService: DocumentService,
		private readonly documentKnowledgeService: DocumentKnowledgeService,
		private readonly documentSettingsService: DocumentSettingsService
	) {}

	/**
	 * Handles the `CreateDocumentCommand`: creates a FOLDER or PAGE node and, when asked for,
	 * enqueues it into AI knowledge.
	 *
	 * The knowledge import lives here rather than inside `DocumentService.createDocument()` for a
	 * DI reason: `DocumentKnowledgeService` already depends on `DocumentService`, so injecting it
	 * the other way round would close a provider cycle. A command handler sits above both.
	 *
	 * @param command - The command carrying the create payload.
	 * @returns The newly created document.
	 */
	public async execute(command: CreateDocumentCommand): Promise<IDocument> {
		const document = await this.documentService.createDocument(command.input);

		if (await this.shouldImportToKnowledge(command, document)) {
			try {
				// The canonical import path: it enforces the indexability rules, sets `QUEUED`,
				// enqueues the right pipeline stage and emits the knowledge event.
				await this.documentKnowledgeService.importToKnowledge(document.id);
			} catch (error) {
				// Importing into knowledge is an enrichment, never a precondition of authoring —
				// a queue or capability failure must not fail the create.
				this.logger.warn(
					`Failed to import document ${document.id} into AI knowledge on create: ${
						(error as Error).message
					}`
				);
			}
		}

		return document;
	}

	/**
	 * Whether this create should enqueue the new document into AI knowledge
	 * (`02-domain-model.md` §11.4/§12).
	 *
	 * 🛑 The DTO whitelists `importToKnowledge`, so it has to mean something: it used to be parsed
	 * and then dropped while the row was written `knowledgeStatus: NONE` unconditionally — silent
	 * acceptance is the one behavior the spec rules out.
	 *
	 * The explicit payload flag wins; when it is omitted the organization's
	 * `importToKnowledgeDefault` decides — the same precedence the upload path applies. FOLDER
	 * nodes are never indexable, so they never ask.
	 *
	 * @param command The create command.
	 * @param document The freshly created document.
	 * @returns True when the knowledge import should run.
	 */
	private async shouldImportToKnowledge(command: CreateDocumentCommand, document: IDocument): Promise<boolean> {
		if (document.kind !== DocumentKindEnum.PAGE) {
			return false;
		}
		if (command.input.importToKnowledge !== undefined) {
			return command.input.importToKnowledge === true;
		}
		try {
			const defaults = await this.documentSettingsService.getDefaults(document.organizationId);
			return defaults.importToKnowledgeDefault === true;
		} catch (error) {
			this.logger.warn(`Failed to read the knowledge-import default: ${(error as Error).message}`);
			return false;
		}
	}
}
