import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IPagination, ITag } from '@gauzy/contracts';
import { TagService } from './../../tag.service';
import { TagListCommand } from './../tag.list.command';

@CommandHandler(TagListCommand)
export class TagListHandler
	implements ICommandHandler<TagListCommand> {
	constructor(
		private readonly tagService: TagService
	) {}

	public async execute(command: TagListCommand): Promise<IPagination<ITag>> {
		const { input, relations } = command;
		return await this.tagService.getTenantOrganizationLevelTags(input, relations);
	}
}
