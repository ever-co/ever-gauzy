import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyCloudService } from '../../gauzy-cloud.service';
import { GauzyCloudTenantMigrateCommand } from './../gauzy-cloud-tenant.migrate.command';

@CommandHandler(GauzyCloudTenantMigrateCommand)
export class GauzyCloudTenantMigrateHandler implements ICommandHandler<GauzyCloudTenantMigrateCommand> {

	constructor(
		private readonly gauzyCloudService: GauzyCloudService
	) {}

	public async execute(command: GauzyCloudTenantMigrateCommand): Promise<any> {
		const { input, token } = command;
		return this.gauzyCloudService.migrateTenant(input, token);
	}
}
