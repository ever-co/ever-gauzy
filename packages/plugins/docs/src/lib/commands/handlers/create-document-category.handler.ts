import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IDocumentCategory } from '@gauzy/contracts';
import { DocumentCategoryService } from '../../services/document-category.service';
import { CreateDocumentCategoryCommand } from '../create-document-category.command';

@CommandHandler(CreateDocumentCategoryCommand)
export class CreateDocumentCategoryHandler implements ICommandHandler<CreateDocumentCategoryCommand> {
	constructor(private readonly documentCategoryService: DocumentCategoryService) {}

	/**
	 * Handles the `CreateDocumentCategoryCommand`: creates a catalog entry (case-insensitive
	 * unique name per org; slug auto-derived when absent).
	 *
	 * @param command - The command carrying the create payload.
	 * @returns The created category.
	 */
	public async execute(command: CreateDocumentCategoryCommand): Promise<IDocumentCategory> {
		return this.documentCategoryService.createCategory(command.input);
	}
}
