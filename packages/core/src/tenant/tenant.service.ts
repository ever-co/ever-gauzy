import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import {
	ITenantCreateInput,
	RolesEnum,
	ITenant,
	IUser,
	FileStorageProviderEnum,
} from '@gauzy/contracts';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { TenantFeatureOrganizationCreateCommand } from './commands';
import { TenantRoleBulkCreateCommand } from '../role/commands';
import { TenantStatusBulkCreateCommand } from './../tasks/statuses/commands';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { TenantSettingSaveCommand } from './tenant-setting/commands';
import { TenantTaskSizeBulkCreateCommand } from './../tasks/sizes/commands';
import { TenantTaskPriorityBulkCreateCommand } from './../tasks/priorities/commands';
import { TenantIssueTypeBulkCreateCommand } from './../tasks/issue-type/commands';
import { MikroOrmTenantRepository, TypeOrmTenantRepository } from './repository';
import { MikroOrmUserRepository, TypeOrmUserRepository } from '../user/repository';
import { MikroOrmRoleRepository, TypeOrmRoleRepository } from '../role/repository';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		readonly mikroOrmTenantRepository: MikroOrmTenantRepository,

		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository,

		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly mikroOrmUserRepository: MikroOrmUserRepository,

		private readonly commandBus: CommandBus,
		private readonly configService: ConfigService
	) {
		super(typeOrmTenantRepository, mikroOrmTenantRepository);
	}

	public async onboardTenant(
		entity: ITenantCreateInput,
		user: IUser
	): Promise<ITenant> {
		const { isImporting = false, sourceId = null } = entity;

		// Create Tenant of user.
		const tenant = await this.create(entity);

		// Create Role/Permissions to relative tenants.
		await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);

		// Create Enabled/Disabled features for relative tenants.
		await this.commandBus.execute(
			new TenantFeatureOrganizationCreateCommand([tenant])
		);

		// Create Default task statuses for relative tenants.
		await this.commandBus.execute(
			new TenantStatusBulkCreateCommand([tenant])
		);

		// Create default task sizes for relative tenants.
		await this.commandBus.execute(
			new TenantTaskSizeBulkCreateCommand([tenant])
		);

		// Create default task priorities for relative tenants.
		await this.commandBus.execute(
			new TenantTaskPriorityBulkCreateCommand([tenant])
		);

		// Create default issue types for relative tenants.
		await this.commandBus.execute(
			new TenantIssueTypeBulkCreateCommand([tenant])
		);

		// Create tenant default file storage setting (LOCAL)
		const tenantId = tenant.id;
		const fileSystem = this.configService.get('fileSystem') as IEnvironment['fileSystem'];
		await this.commandBus.execute(
			new TenantSettingSaveCommand(
				{
					fileStorageProvider:
						(fileSystem.name.toUpperCase() as FileStorageProviderEnum) ||
						FileStorageProviderEnum.LOCAL,
				},
				tenantId
			)
		);

		// Find SUPER_ADMIN role to relative tenant.
		const role = await this.typeOrmRoleRepository.findOneBy({
			tenantId,
			name: RolesEnum.SUPER_ADMIN,
		});

		// Assign tenant and role to user.
		await this.typeOrmUserRepository.update(user.id, {
			tenant: {
				id: tenant.id,
			},
			role: {
				id: role.id,
			},
		});

		// Create Import Records while migrating for relative tenant.
		if (isImporting && sourceId) {
			const { sourceId, userSourceId } = entity;
			await this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.typeOrmTenantRepository.metadata.tableName,
					sourceId,
					destinationId: tenant.id,
					tenantId: tenant.id,
				})
			);
			if (userSourceId) {
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand({
						entityType: this.typeOrmUserRepository.metadata.tableName,
						sourceId: userSourceId,
						destinationId: user.id
					}, {
						tenantId: tenant.id
					})
				);
			}
		}

		return tenant;
	}
}
