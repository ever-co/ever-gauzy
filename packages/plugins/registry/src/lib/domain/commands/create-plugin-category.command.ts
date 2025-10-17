import { ICommand } from '@nestjs/cqrs';
import { IPluginCategoryCreateInput } from '../../shared/models';

export class CreatePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Create';

	constructor(
		public readonly input: IPluginCategoryCreateInput
	) {}
}
