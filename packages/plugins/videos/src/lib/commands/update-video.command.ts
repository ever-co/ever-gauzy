import { ICommand } from '@nestjs/cqrs';
import { UpdateVideoDTO } from '../dto';

export class UpdateVideoCommand implements ICommand {
	public static readonly type = '[Update] Video';
	constructor(public readonly input: UpdateVideoDTO) {}
}
