import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITag } from '@gauzy/contracts';
import { OrganizationTeamTagBulkCreateCommand } from '../organization-team-tag-bulk-create.command';
import { TagService } from '../../tag.service';

@CommandHandler(OrganizationTeamTagBulkCreateCommand)
export class OrganizationTeamTagBulkCreateHandler implements ICommandHandler<OrganizationTeamTagBulkCreateCommand> {
	constructor(private readonly tagService: TagService) {}

	/**
	 * Creates the starter labels of a team just created, as the team's own tags.
	 *
	 * @param command The team.
	 * @returns The tags created; none when the team has them already.
	 */
	public async execute(command: OrganizationTeamTagBulkCreateCommand): Promise<ITag[]> {
		return await this.tagService.createTeamStarterTags(command.input);
	}
}
