import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class ArchiveDocumentCommand implements ICommand {
	public static readonly type = '[Document] Archive';
	constructor(public readonly id: ID) {}
}
