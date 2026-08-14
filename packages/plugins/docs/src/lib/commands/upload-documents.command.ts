import { ICommand } from '@nestjs/cqrs';
import { UploadedFile } from '@gauzy/contracts';
import { UploadDocumentsDTO } from '../dto';

export class UploadDocumentsCommand implements ICommand {
	public static readonly type = '[Document] Upload';
	constructor(public readonly input: UploadDocumentsDTO, public readonly files: UploadedFile[]) {}
}
