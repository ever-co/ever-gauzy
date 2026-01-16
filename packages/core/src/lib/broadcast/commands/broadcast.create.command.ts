import { ICommand } from '@nestjs/cqrs';
import { IBroadcastCreateInput } from '@gauzy/contracts';

export class BroadcastCreateCommand implements ICommand {
	static readonly type = '[Broadcast] Create';

	constructor(public readonly input: IBroadcastCreateInput) {}
}
