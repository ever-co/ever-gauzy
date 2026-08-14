import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { MergeDocumentCategoryDTO } from '../dto';

export class MergeDocumentCategoryCommand implements ICommand {
	public static readonly type = '[Document Category] Merge';
	constructor(public readonly id: ID, public readonly input: MergeDocumentCategoryDTO) {}
}
