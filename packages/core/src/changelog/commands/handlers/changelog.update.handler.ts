import { IChangelog } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ChangelogService } from '../../changelog.service';
import { ChangelogUpdateCommand } from '../changelog.update.command';

@CommandHandler(ChangelogUpdateCommand)
export class ChangelogUpdateHandler
	implements ICommandHandler<ChangelogUpdateCommand> {
	constructor(private readonly changelogService: ChangelogService) {}

	public async execute(command: ChangelogUpdateCommand): Promise<IChangelog> {
		const { input } = command;
		const { id } = input;
		return this.changelogService.create({ id, ...input });
	}
}
