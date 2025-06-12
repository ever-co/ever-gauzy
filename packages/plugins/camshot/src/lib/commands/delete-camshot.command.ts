import { ICommand } from '@nestjs/cqrs';
import { DeleteCamshotDTO } from '../dtos/delete-camshot.dto';
import { ID } from '@gauzy/contracts';

export class DeleteCamshotCommand implements ICommand {
	public static readonly type = '[Camshot] Delete';
	constructor(public readonly id: ID, public readonly input: DeleteCamshotDTO) {}
}
