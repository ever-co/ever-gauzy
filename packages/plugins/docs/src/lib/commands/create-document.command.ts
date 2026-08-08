import { ICommand } from '@nestjs/cqrs';
import { CreateDocumentDTO } from '../dto';

export class CreateDocumentCommand implements ICommand {
	public static readonly type = '[Document] Create';
	constructor(public readonly input: CreateDocumentDTO) {}
}
