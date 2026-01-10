import { ICommand } from '@nestjs/cqrs';
import { CreatePluginDTO } from '../../../shared';

export class CreatePluginCommand implements ICommand {
	public static readonly type = '[Plugins] Create';
	constructor(public readonly input: CreatePluginDTO) {}
}
