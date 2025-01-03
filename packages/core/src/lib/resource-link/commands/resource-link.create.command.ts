import { ICommand } from '@nestjs/cqrs';
import { IResourceLinkCreateInput } from '@gauzy/contracts';

export class ResourceLinkCreateCommand implements ICommand {
	static readonly type = '[Resource Link] Create';

	constructor(public readonly input: IResourceLinkCreateInput) {}
}
