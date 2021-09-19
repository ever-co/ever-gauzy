import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { catchError, tap } from 'rxjs/operators';
import { of as observableOf } from 'rxjs/internal/observable/of';
import { ITenant } from '@gauzy/contracts';
import { GauzyCloudService } from '../../gauzy-cloud.service';
import { RoleService } from './../../../role/role.service';
import { GauzyCloudTenantMigrateCommand } from './../gauzy-cloud-tenant.migrate.command';
import { RolePermissionService } from './../../../role-permission/role-permission.service';

@CommandHandler(GauzyCloudTenantMigrateCommand)
export class GauzyCloudTenantMigrateHandler implements ICommandHandler<GauzyCloudTenantMigrateCommand> {

	constructor(
		private readonly _gauzyCloudService: GauzyCloudService,
		private readonly _roleService: RoleService,
		private readonly _rolePermissionService: RolePermissionService
	) {}

	public async execute(command: GauzyCloudTenantMigrateCommand): Promise<any> {
		const { input, token } = command;
		return this._gauzyCloudService.migrateTenant(input, token).pipe(
			tap(async (response: any) => {
				if (response && response.data) {
					const tenant = response.data;

					await this.migrateRoles(tenant, token);
					await this.migratePermissions(tenant, token);
				}
			}),
			catchError((error) => {
				console.log('Bad Promise:', error);
				return observableOf(error)
			})
		);
	}

	private async migrateRoles(
		tenant: ITenant, 
		token: string
	) {
		return this._gauzyCloudService.migrateRoles(
			await this._roleService.migrateRoles(), 
			token, 
			tenant
		)
		.toPromise();
	}

	private async migratePermissions(
		tenant: ITenant, 
		token: string
	) {
		return this._gauzyCloudService.migrateRolePermissions(
			await this._rolePermissionService.migratePermissions(), 
			token, 
			tenant
		)
		.toPromise();
	}
}
