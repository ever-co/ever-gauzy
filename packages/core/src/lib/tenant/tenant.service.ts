import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ITenantCreateInput, RolesEnum, ITenant, IUser, FileStorageProviderEnum } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { TenantFeatureOrganizationCreateCommand } from './commands';
import { TenantRoleBulkCreateCommand } from '../role/commands';
import { TenantStatusBulkCreateCommand } from './../tasks/statuses/commands';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { TenantSettingSaveCommand } from './tenant-setting/commands';
import { TenantTaskSizeBulkCreateCommand } from './../tasks/sizes/commands';
import { TenantTaskPriorityBulkCreateCommand } from './../tasks/priorities/commands';
import { TenantIssueTypeBulkCreateCommand } from './../tasks/issue-type/commands';
import { TypeOrmRoleRepository } from '../role/repository/type-orm-role.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmTenantRepository } from './repository/type-orm-tenant.repository';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		readonly mikroOrmTenantRepository: MikroOrmTenantRepository,
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly commandBus: CommandBus,
		readonly configService: ConfigService
	) {
		super(typeOrmTenantRepository, mikroOrmTenantRepository);
	}

	/**
	 * Onboard a tenant and assigns roles to a user. This involves tenant creation,
	 * executing update tasks, assigning the SUPER_ADMIN role, and handling import records.
	 *
	 * @param entity Tenant creation details.
	 * @param user User to be associated with the tenant.
	 * @returns The created ITenant entity.
	 */
	public async onboardTenant(entity: ITenantCreateInput, user: IUser): Promise<ITenant> {
		console.time('On Boarding Tenant');

		// Creates and saves a tenant entity from the given details.
		const tenant = await this.create(entity);

		// Create Role/Permissions to relative tenants.
		await this.commandBus.execute(new TenantRoleBulkCreateCommand([tenant]));

		// Executes Runs update tasks for the newly created tenant.
		this.executeTenantUpdateTasks(tenant);

		// Store the unique identifier of the tenant for easy access in subsequent operations.
		const tenantId = tenant.id;

		// Find SUPER_ADMIN role to relative tenant.
		const role = await this.typeOrmRoleRepository.findOneBy({
			tenantId,
			name: RolesEnum.SUPER_ADMIN
		});

		// Update the user entity to assign the specified tenant and role.
		await this.typeOrmUserRepository.update(user.id, {
			tenant: { id: tenantId },
			role: { id: role.id }
		});

		// Create Import Records while migrating for relative tenant.
		await this.importRecords(entity, tenant, user);

		console.timeEnd('On Boarding Tenant');
		return tenant;
	}

	/**
	 * Executes a set of update tasks for a given tenant in parallel.
	 *
	 * @param tenant An instance of the Tenant class.
	 * @returns Promise<void>
	 */
	public async executeTenantUpdateTasks(tenant: Tenant): Promise<void> {
		try {
			// 2. Create Enabled/Disabled features for relative tenants.
			await this.commandBus.execute(new TenantFeatureOrganizationCreateCommand([tenant]));

			// 3. Create Default task statuses for relative tenants.
			await this.commandBus.execute(new TenantStatusBulkCreateCommand([tenant]));

			// 4. Create default task sizes for relative tenants.
			await this.commandBus.execute(new TenantTaskSizeBulkCreateCommand([tenant]));

			// 5. Create default task priorities for relative tenants.
			await this.commandBus.execute(new TenantTaskPriorityBulkCreateCommand([tenant]));

			// 6. Create default issue types for relative tenants.
			await this.commandBus.execute(new TenantIssueTypeBulkCreateCommand([tenant]));

			// 7. Initializes and sets up the default settings for the new tenant, including configuring the file storage provider. This operation waits for completion before moving to the next step.
			await this.initializeTenantSettings(tenant);
		} catch (error) {
			console.log(error, 'Error occurred while executing tenant create tasks:', error.message);
		}
	}

	/**
	 * Initializes settings for a new tenant, particularly setting up the file storage provider.
	 * It retrieves the file system configuration and defaults to LOCAL storage if no specific
	 * setting is found. Then, it executes a TenantSettingSaveCommand to save these settings for the tenant.
	 *
	 * @param tenant The tenant entity for which settings are being initialized.
	 */
	private async initializeTenantSettings(tenant: ITenant): Promise<void> {
		const fileSystem = this.configService.get('fileSystem');
		const fileStorageProvider = fileSystem.name.toUpperCase() as FileStorageProviderEnum;

		await this.commandBus.execute(new TenantSettingSaveCommand({ fileStorageProvider }, tenant.id));
	}

	/**
	 * Handles the creation of import records for a tenant and associated user based on migration data.
	 * It checks the tenant creation input for import requirements and processes accordingly.
	 *
	 * @param entity Details about the tenant import.
	 * @param tenant The tenant entity.
	 * @param user The associated user entity.
	 */
	public async importRecords(entity: ITenantCreateInput, tenant: ITenant, user: IUser) {
		const { isImporting = false, sourceId = null, userSourceId = null } = entity;
		const { id: tenantId } = tenant;

		if (isImporting && sourceId) {
			// Executes a command to either update an existing import record or create a new one for the tenant entity.
			await this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.typeOrmTenantRepository.metadata.tableName,
					sourceId,
					destinationId: tenantId,
					tenantId
				})
			);

			// If a user source ID is provided, execute a command to update or create an import record for the user entity.
			if (userSourceId) {
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand(
						{
							entityType: this.typeOrmUserRepository.metadata.tableName,
							sourceId: userSourceId,
							destinationId: user.id
						},
						{
							tenantId
						}
					)
				);
			}
		}
	}
}
