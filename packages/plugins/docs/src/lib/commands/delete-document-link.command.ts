import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class DeleteDocumentLinkCommand implements ICommand {
	public static readonly type = '[Document Link] Delete';
	constructor(public readonly id: ID) {}
}
