import { ICommand } from '@nestjs/cqrs';
import { IPluginCategoryUpdateInput } from '../../shared/models';

export class UpdatePluginCategoryCommand implements ICommand {
	static readonly type = '[Plugin Category] Update';

	constructor(
		public readonly id: string,
		public readonly input: IPluginCategoryUpdateInput
	) {}
}
