import { ICommand } from '@nestjs/cqrs';
import { IPluginCategoryUpdateInput } from '../../shared/models';
import { ID } from '@gauzy/contracts';

export class UpdatePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Update';

	constructor(public readonly id: ID, public readonly input: IPluginCategoryUpdateInput) {}
}
