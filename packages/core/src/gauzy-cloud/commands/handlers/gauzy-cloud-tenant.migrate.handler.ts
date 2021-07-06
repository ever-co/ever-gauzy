import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { catchError, tap } from 'rxjs/operators';
import { of as observableOf } from 'rxjs/internal/observable/of';
import { GauzyCloudService } from '../../gauzy-cloud.service';
import { RoleService } from './../../../role/role.service';
import { GauzyCloudTenantMigrateCommand } from './../gauzy-cloud-tenant.migrate.command';

@CommandHandler(GauzyCloudTenantMigrateCommand)
export class GauzyCloudTenantMigrateHandler implements ICommandHandler<GauzyCloudTenantMigrateCommand> {

	constructor(
		private readonly _gauzyCloudService: GauzyCloudService,
		private readonly _roleService: RoleService
	) {}

	public async execute(command: GauzyCloudTenantMigrateCommand): Promise<any> {
		const { input, token } = command;
		return this._gauzyCloudService.migrateTenant(input, token).pipe(
			tap(async () => await this.mergeRoles(token)),
			catchError((error) => {
				console.log('Bad Promise:', error);
				return observableOf(error)
			})
		);
	}

	private async mergeRoles(token: string) {
		return this._gauzyCloudService.migrateRoles(
			await this._roleService.migrateRoles(), 
			token
		);
	}
}
