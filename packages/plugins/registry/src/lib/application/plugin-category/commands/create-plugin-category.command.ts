import { ICommand } from '@nestjs/cqrs';
import { IPluginCategoryCreateInput } from '../../../shared';

export class CreatePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Create';

	constructor(public readonly input: IPluginCategoryCreateInput) {}
}
