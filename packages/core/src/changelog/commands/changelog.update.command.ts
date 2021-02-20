import { IChangelogUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ChangelogUpdateCommand implements ICommand {
	static readonly type = '[Changelog] Update';

	constructor(public readonly input: IChangelogUpdateInput) {}
}
