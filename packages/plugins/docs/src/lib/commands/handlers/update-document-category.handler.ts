import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentCategory } from '@gauzy/contracts';
import { DocumentCategoryService } from '../../services/document-category.service';
import { UpdateDocumentCategoryCommand } from '../update-document-category.command';

@CommandHandler(UpdateDocumentCategoryCommand)
export class UpdateDocumentCategoryHandler implements ICommandHandler<UpdateDocumentCategoryCommand> {
	constructor(private readonly documentCategoryService: DocumentCategoryService) {}

	/**
	 * Handles the `UpdateDocumentCategoryCommand`: updates a catalog entry (`isSystem` rows:
	 * rename allowed, slug immutable).
	 *
	 * @param command - The command carrying the id and update payload.
	 * @returns The updated category.
	 */
	public async execute(command: UpdateDocumentCategoryCommand): Promise<IDocumentCategory> {
		return this.documentCategoryService.updateCategory(command.id, command.input);
	}
}
