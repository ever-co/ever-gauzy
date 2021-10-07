import { ICommand } from '@nestjs/cqrs';
import { ITagFindInput } from '@gauzy/contracts';

export class TagListCommand implements ICommand {
	static readonly type = '[Tag] List';

	constructor(
		public readonly input: ITagFindInput,
		public readonly relations: string[],
	) {}
}
