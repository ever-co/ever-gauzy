import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IResourceLink } from '@gauzy/contracts';
import { ResourceLinkService } from '../../resource-link.service';
import { ResourceLinkUpdateCommand } from '../resource-link.update.command';

@CommandHandler(ResourceLinkUpdateCommand)
export class ResourceLinkUpdateHandler implements ICommandHandler<ResourceLinkUpdateCommand> {
	constructor(private readonly resourceLinkService: ResourceLinkService) {}

	public async execute(command: ResourceLinkUpdateCommand): Promise<IResourceLink | UpdateResult> {
		const { id, input } = command;
		return await this.resourceLinkService.update(id, input);
	}
}
