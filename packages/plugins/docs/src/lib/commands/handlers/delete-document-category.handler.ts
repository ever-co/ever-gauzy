import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentCategory } from '@gauzy/contracts';
import { DocumentCategoryService } from '../../services/document-category.service';
import { DeleteDocumentCategoryCommand } from '../delete-document-category.command';

@CommandHandler(DeleteDocumentCategoryCommand)
export class DeleteDocumentCategoryHandler implements ICommandHandler<DeleteDocumentCategoryCommand> {
	constructor(private readonly documentCategoryService: DocumentCategoryService) {}

	/**
	 * Handles the `DeleteDocumentCategoryCommand`: detaches the category from documents, then
	 * soft-deletes it (`isSystem: true` rows are rejected with 409).
	 *
	 * @param command - The command carrying the id.
	 * @returns The soft-deleted category.
	 */
	public async execute(command: DeleteDocumentCategoryCommand): Promise<IDocumentCategory> {
		return this.documentCategoryService.deleteCategory(command.id);
	}
}
