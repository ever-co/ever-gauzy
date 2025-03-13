import { ICommand } from '@nestjs/cqrs';
import { CreatePluginDTO } from '../../shared/dto/create-plugin.dto';

export class CreatePluginCommand implements ICommand {
	constructor(public readonly input: CreatePluginDTO) {}
}
