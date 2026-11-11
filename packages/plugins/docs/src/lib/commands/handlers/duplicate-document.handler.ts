import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocument } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DocumentLiveBridge } from '../../services/document-live.bridge';
import { DocumentService } from '../../services/document.service';
import { DocumentTreeService } from '../../services/document-tree.service';
import { DuplicateDocumentCommand } from '../duplicate-document.command';

@CommandHandler(DuplicateDocumentCommand)
export class DuplicateDocumentHandler implements ICommandHandler<DuplicateDocumentCommand> {
	constructor(
		private readonly documentService: DocumentService,
		private readonly documentTreeService: DocumentTreeService,
		private readonly liveBridge: DocumentLiveBridge
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
		// A page being edited live is copied as its editors see it, not as its last persist left it.
		await this.liveBridge.flush(command.id, RequestContext.currentTenantId());
		const document = await this.documentService.findOneScoped(command.id);

		if (command.input?.parentId) {
			const parent = await this.documentService.findOneScoped(command.input.parentId);
			await this.documentService.assertCanWrite(parent);
		}

		// A deep copy takes only the descendants the caller may read: each copy becomes the caller's own document.
		const copy = await this.documentTreeService.duplicateDocument(document, command.input, (descendant) =>
			this.documentService.canRead(descendant)
		);
		this.documentService.emitDocumentEvent(copy, 'created');
		return copy;
	}
}
