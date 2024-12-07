import { ICommand } from '@nestjs/cqrs';
import { IResourceLinkUpdateInput, ID } from '@gauzy/contracts';

export class ResourceLinkUpdateCommand implements ICommand {
	static readonly type = '[Resource Link] Update';

	constructor(public readonly id: ID, public readonly input: IResourceLinkUpdateInput) {}
}
