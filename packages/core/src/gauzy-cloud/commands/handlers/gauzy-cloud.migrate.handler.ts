import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyCloudService } from './../../../gauzy-cloud/gauzy-cloud.service';
import { GauzyCloudMigrateCommand } from './../gauzy-cloud.migrate.command';

@CommandHandler(GauzyCloudMigrateCommand)
export class GauzyCloudMigrateHandler implements ICommandHandler<GauzyCloudMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: GauzyCloudService
	) {}

	public async execute(command: GauzyCloudMigrateCommand): Promise<any> {
		const { input } = command;
		return this.gauzyCloudService.migrateUser(input);
	}
}
