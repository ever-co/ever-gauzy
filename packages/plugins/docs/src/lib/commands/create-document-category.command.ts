import { ICommand } from '@nestjs/cqrs';
import { CreateDocumentCategoryDTO } from '../dto';

export class CreateDocumentCategoryCommand implements ICommand {
	public static readonly type = '[Document Category] Create';
	constructor(public readonly input: CreateDocumentCategoryDTO) {}
}
