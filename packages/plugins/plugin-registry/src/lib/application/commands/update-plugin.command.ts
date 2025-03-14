import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginDTO } from '../../shared/dto/update-plugin.dto';

export class UpdatePluginCommand implements ICommand {
	constructor(public readonly id: ID, public readonly input: UpdatePluginDTO) {}
}
