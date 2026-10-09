import { ICommand } from '@nestjs/cqrs';
import { CreateDocumentLinkDTO } from '../dto';

export class CreateDocumentLinkCommand implements ICommand {
	public static readonly type = '[Document Link] Create';
	constructor(public readonly input: CreateDocumentLinkDTO) {}
}
