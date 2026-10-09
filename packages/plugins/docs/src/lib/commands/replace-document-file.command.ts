import { ICommand } from '@nestjs/cqrs';
import { ID, UploadedFile } from '@gauzy/contracts';
import { ReplaceDocumentFileDTO } from '../dto';

export class ReplaceDocumentFileCommand implements ICommand {
	public static readonly type = '[Document] Replace File';
	constructor(
		public readonly id: ID,
		public readonly input: ReplaceDocumentFileDTO,
		public readonly file: UploadedFile
	) {}
}
