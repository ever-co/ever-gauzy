import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Tenant } from './tenant.entity';
import {
	ITenantCreateInput,
	RolesEnum,
	ITenant,
	IUser,
	FileStorageProviderEnum
} from '@gauzy/contracts';
import { ConfigService, IEnvironment } from '@gauzy/config';
import { TenantFeatureOrganizationCreateCommand } from './commands';
import { TenantRoleBulkCreateCommand } from '../role/commands';
import { TenantStatusBulkCreateCommand } from './../statuses/commands';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { Role, User } from './../core/entities/internal';
import { TenantSettingSaveCommand } from './tenant-setting/commands';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		@InjectRepository(Tenant) private readonly tenantRepository: Repository<Tenant>,
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Role) private readonly roleRepository: Repository<Role>,
		private readonly commandBus: CommandBus,
		private readonly configService: ConfigService
	) {
		super(tenantRepository);
	}

	public async onboardTenant(
		entity: ITenantCreateInput,
		user: IUser
	): Promise<ITenant> {
		const { isImporting = false, sourceId = null } = entity;

		// 1. Create Tenant of user.
		const tenant = await this.create(entity);

		// 2. Create Role/Permissions to relative tenants.
		await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);

		// 3. Create Enabled/Disabled features for relative tenants.
		await this.commandBus.execute(
			new TenantFeatureOrganizationCreateCommand([tenant])
		);

		// 4. Create Default task statuses for relative tenants.
		await this.commandBus.execute(
			new TenantStatusBulkCreateCommand([tenant])
		);

		// 5. Create tenant default file stoage setting (LOCAL)
		const tenantId = tenant.id;
		const fileSystem = this.configService.get('fileSystem') as IEnvironment['fileSystem'];
		await this.commandBus.execute(
			new TenantSettingSaveCommand({
					fileStorageProvider: (fileSystem.name).toUpperCase() as FileStorageProviderEnum || FileStorageProviderEnum.LOCAL,
				},
				tenantId
			)
		);

		// 6. Find SUPER_ADMIN role to relative tenant.
		const role = await this.roleRepository.findOneBy({
			tenantId,
			name: RolesEnum.SUPER_ADMIN
		});

		// 7. Assign tenant and role to user.
		await this.userRepository.update(user.id, {
			tenant: {
				id: tenant.id
			},
			role: {
				id: role.id
			}
		});

		// 8. Create Import Records while migrating for relative tenant.
		if (isImporting && sourceId) {
			const { sourceId, userSourceId } = entity;
			await this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.tenantRepository.metadata.tableName,
					sourceId,
					destinationId: tenant.id,
					tenantId: tenant.id
				})
			);
			if (userSourceId) {
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand({
						entityType: this.userRepository.metadata.tableName,
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
