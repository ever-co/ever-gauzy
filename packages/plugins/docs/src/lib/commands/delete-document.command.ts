import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class DeleteDocumentCommand implements ICommand {
	public static readonly type = '[Document] Delete';
	constructor(public readonly id: ID, public readonly strategy: 'subtree' | 'promote-children' = 'subtree') {}
}
