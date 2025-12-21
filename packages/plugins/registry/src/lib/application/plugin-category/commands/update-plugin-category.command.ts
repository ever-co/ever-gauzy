import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { IPluginCategoryUpdateInput } from '../../../shared';

export class UpdatePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Update';

	constructor(public readonly id: ID, public readonly input: IPluginCategoryUpdateInput) {}
}
