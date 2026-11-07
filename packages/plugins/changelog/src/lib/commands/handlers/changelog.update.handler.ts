import { IChangelog } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { resolveChangelogPlatform } from '../../changelog-platform';
import { ChangelogService } from '../../changelog.service';
import { ChangelogUpdateCommand } from '../changelog.update.command';

@CommandHandler(ChangelogUpdateCommand)
export class ChangelogUpdateHandler implements ICommandHandler<ChangelogUpdateCommand> {
	constructor(private readonly changelogService: ChangelogService) {}

	public async execute(command: ChangelogUpdateCommand): Promise<IChangelog> {
		const { input } = command;
		const { id } = input;
		// No fallback: an update that leaves the product out keeps the entry where it is.
		const { platform: _platform, ...rest } = input;
		const platform = resolveChangelogPlatform(_platform);
		return this.changelogService.create({ ...rest, ...(platform ? { platform } : {}), id });
	}
}
