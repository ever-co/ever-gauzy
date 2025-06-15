import { CreateCamshotDTO } from "../dtos/create-camshot.dto";
import { ICommand } from '@nestjs/cqrs';
import { FileDTO } from "../dtos/file.dto";

export class CreateCamshotCommand implements ICommand {
	public static readonly type = '[Camshot] Create';
	constructor(
		public readonly input: CreateCamshotDTO,
		public readonly file: FileDTO
	) { }
}
