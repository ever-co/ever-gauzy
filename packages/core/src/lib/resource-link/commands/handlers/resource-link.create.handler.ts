import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IResourceLink } from '@gauzy/contracts';
import { ResourceLinkService } from '../../resource-link.service';
import { ResourceLinkCreateCommand } from '../resource-link.create.command';

@CommandHandler(ResourceLinkCreateCommand)
export class ResourceLinkCreateHandler implements ICommandHandler<ResourceLinkCreateCommand> {
	constructor(private readonly resourceLinkService: ResourceLinkService) {}

	public async execute(command: ResourceLinkCreateCommand): Promise<IResourceLink> {
		const { input } = command;
		return await this.resourceLinkService.create(input);
	}
}
