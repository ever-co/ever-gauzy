import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyCloudService } from '../../gauzy-cloud.service';
import { GauzyCloudOrganizationMigrateCommand } from './../gauzy-cloud-organization.migrate.command';

@CommandHandler(GauzyCloudOrganizationMigrateCommand)
export class GauzyCloudOrganizationMigrateHandler implements ICommandHandler<GauzyCloudOrganizationMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: GauzyCloudService
	) {}

	public async execute(command: GauzyCloudOrganizationMigrateCommand): Promise<any> {
		const { input, token } = command;
		return this.gauzyCloudService.migrateOrganization(input, token);
	}
}
