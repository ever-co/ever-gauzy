import { ICommand } from '@nestjs/cqrs';
import { IReactionUpdateInput, ID } from '@gauzy/contracts';

export class ReactionUpdateCommand implements ICommand {
	static readonly type = '[Reaction] Update';

	constructor(public readonly id: ID, public readonly input: IReactionUpdateInput) {}
}
