import { IChangelog } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ChangelogService } from '../../changelog.service';
import { ChangelogCreateCommand } from '../changelog.create.command';

@CommandHandler(ChangelogCreateCommand)
export class ChangelogCreateHandler
	implements ICommandHandler<ChangelogCreateCommand> {
	constructor(private readonly changelogService: ChangelogService) {}

	public async execute(command: ChangelogCreateCommand): Promise<IChangelog> {
		const { input } = command;
		delete input['id'];
		return this.changelogService.create(input);
	}
}
