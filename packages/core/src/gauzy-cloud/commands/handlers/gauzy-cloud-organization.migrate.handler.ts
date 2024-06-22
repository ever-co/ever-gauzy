import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { i4netCloudService } from '../../gauzy-cloud.service';
import { i4netCloudOrganizationMigrateCommand } from './../gauzy-cloud-organization.migrate.command';

@CommandHandler(i4netCloudOrganizationMigrateCommand)
export class i4netCloudOrganizationMigrateHandler implements ICommandHandler<i4netCloudOrganizationMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: i4netCloudService
	) { }

	public async execute(command: i4netCloudOrganizationMigrateCommand): Promise<any> {
		const { input, token } = command;
		return this.gauzyCloudService.migrateOrganization(input, token);
	}
}
