import { ICommand } from '@nestjs/cqrs';
import { CreateVideoDTO } from '../dto';

export class CreateVideoCommand implements ICommand {
	public static readonly type = '[Create] Video';
	constructor(public readonly input: CreateVideoDTO) {}
}
