import { CreateSoundshotDTO } from "../dtos/create-soundshot.dto";
import { ICommand } from '@nestjs/cqrs';
import { FileDTO } from "../dtos/file.dto";

export class CreateSoundshotCommand implements ICommand {
	public static readonly type = '[Soundshot] Create';
	constructor(
		public readonly input: CreateSoundshotDTO,
		public readonly file: FileDTO
	) { }
}
