import { ICommand } from '@nestjs/cqrs';
import { DeleteVideoDTO } from '../dto';

export class DeleteVideoCommand implements ICommand {
	public static readonly type = '[Delete] Video';
	constructor(public readonly input: DeleteVideoDTO) {}
}
