import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Delete';

	constructor(public readonly id: ID) {}
}
