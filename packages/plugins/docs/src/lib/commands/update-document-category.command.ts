import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { UpdateDocumentCategoryDTO } from '../dto';

export class UpdateDocumentCategoryCommand implements ICommand {
	public static readonly type = '[Document Category] Update';
	constructor(public readonly id: ID, public readonly input: UpdateDocumentCategoryDTO) {}
}
