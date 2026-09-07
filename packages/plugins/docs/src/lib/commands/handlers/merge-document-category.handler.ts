import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentCategory } from '@gauzy/contracts';
import { DocumentCategoryService } from '../../services/document-category.service';
import { MergeDocumentCategoryCommand } from '../merge-document-category.command';

@CommandHandler(MergeDocumentCategoryCommand)
export class MergeDocumentCategoryHandler implements ICommandHandler<MergeDocumentCategoryCommand> {
	constructor(private readonly documentCategoryService: DocumentCategoryService) {}

	/**
	 * Handles the `MergeDocumentCategoryCommand`: re-points all document assignments to the
	 * target (deduplicated), then soft-deletes the source.
	 *
	 * @param command - The command carrying the source id and target payload.
	 * @returns The surviving category.
	 */
	public async execute(command: MergeDocumentCategoryCommand): Promise<IDocumentCategory> {
		return this.documentCategoryService.mergeCategory(command.id, command.input.targetId);
	}
}
