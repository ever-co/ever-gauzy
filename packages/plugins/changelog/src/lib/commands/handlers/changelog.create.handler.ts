import { DEFAULT_CHANGELOG_PLATFORM, IChangelog } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { resolveChangelogPlatform } from '../../changelog-platform';
import { ChangelogService } from '../../changelog.service';
import { ChangelogCreateCommand } from '../changelog.create.command';

@CommandHandler(ChangelogCreateCommand)
export class ChangelogCreateHandler implements ICommandHandler<ChangelogCreateCommand> {
	constructor(private readonly changelogService: ChangelogService) {}

	public async execute(command: ChangelogCreateCommand): Promise<IChangelog> {
		const { input } = command;
		if (input.hasOwnProperty('id')) {
			delete input['id'];
		}
		// An entry that names no product is Gauzy's, as every entry was before products existed.
		const platform = resolveChangelogPlatform(input.platform, DEFAULT_CHANGELOG_PLATFORM);
		return this.changelogService.create({ ...input, platform });
	}
}
