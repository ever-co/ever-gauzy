import { ICommand } from "@nestjs/cqrs";
import { DeleteSoundshotDTO } from "../dtos/delete-soundshot.dto";
import { ID } from "@gauzy/contracts";

export class DeleteSoundshotCommand implements ICommand {
	public static readonly type = '[Soundshot] Delete';
	constructor(public readonly id: ID, public readonly input: DeleteSoundshotDTO) { }
}
