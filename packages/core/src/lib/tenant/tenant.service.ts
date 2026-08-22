import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ITenantCreateInput, RolesEnum, ITenant, IUser, FileStorageProviderEnum } from '@gauzy/contracts';
import { ConfigService } from '@gauzy/config';
import { MultiORMEnum } from '../core/utils';
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
import { MikroOrmRoleRepository } from '../role/repository/mikro-orm-role.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmTenantRepository } from './repository/type-orm-tenant.repository';
import { MikroOrmTenantRepository } from './repository/mikro-orm-tenant.repository';
import { Tenant } from './tenant.entity';
import { StripeSubscriptionService } from '../shared/billing/stripe-subscription.service';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	constructor(
		readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		readonly mikroOrmTenantRepository: MikroOrmTenantRepository,
		readonly typeOrmRoleRepository: TypeOrmRoleRepository,
		readonly mikroOrmRoleRepository: MikroOrmRoleRepository,
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly mikroOrmUserRepository: MikroOrmUserRepository,
		readonly commandBus: CommandBus,
		readonly configService: ConfigService,
		readonly stripeSubscriptionService: StripeSubscriptionService
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

		// Record which Stripe customer this tenant bills through, while the buyer's email is still the
		// only thing tying the two together. From here on the stored id is authoritative — see
		// linkStripeCustomer() for why the email is never consulted again.
		await this.linkStripeCustomer(tenant, user);

		// Create Role/Permissions to relative tenants.
		await this.commandBus.execute(new TenantRoleBulkCreateCommand([tenant]));

		// Executes Runs update tasks for the newly created tenant.
		this.executeTenantUpdateTasks(tenant);

		// Store the unique identifier of the tenant for easy access in subsequent operations.
		const tenantId = tenant.id;

		// Find SUPER_ADMIN role for the relative tenant.
		let role;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				role = await this.mikroOrmRoleRepository.findOne({
					tenantId,
					name: RolesEnum.SUPER_ADMIN
				} as any);
				break;
			case MultiORMEnum.TypeORM:
			default:
				role = await this.typeOrmRoleRepository.findOneBy({
					tenantId,
					name: RolesEnum.SUPER_ADMIN
				});
				break;
		}

		// Update the user entity to assign the specified tenant and role.
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				await this.mikroOrmUserRepository.nativeUpdate(
					{ id: user.id } as any,
					{ tenant: tenantId, role: role.id } as any
				);
				break;
			case MultiORMEnum.TypeORM:
			default:
				await this.typeOrmUserRepository.update(user.id, {
					tenant: { id: tenantId },
					role: { id: role.id }
				});
				break;
		}

		// Create Import Records while migrating for relative tenant.
		await this.importRecords(entity, tenant, user);

		console.timeEnd('On Boarding Tenant');
		return tenant;
	}

	/**
	 * Records which Stripe customer a freshly created tenant bills through.
	 *
	 * This is the one moment where the buyer's email is the only link between the account they just
	 * paid for and the tenant they are creating. Resolving it here and storing the id means every
	 * later billing call is keyed on something stable: an email can be changed, and Stripe permits
	 * several customers to share one, so it cannot identify a billing account on its own.
	 *
	 * Best-effort by design. On a self-hosted install there is no Stripe key and this returns
	 * immediately; if Stripe is unreachable the tenant is still created and simply has no link yet.
	 * Onboarding must never fail because a payments provider had a bad minute.
	 */
	private async linkStripeCustomer(tenant: ITenant, user: IUser): Promise<void> {
		if (!this.stripeSubscriptionService.isBillingEnforced()) return;
		if (!user?.email || !tenant?.id) return;

		const stripeCustomerId = await this.stripeSubscriptionService.findCustomerIdForEmail(user.email);
		if (!stripeCustomerId) return;

		// Through CrudService rather than the TypeORM repository directly: this class is multi-ORM, and
		// writing straight to typeOrmTenantRepository would silently do nothing on a deployment running
		// DB_ORM=mikro-orm, leaving the tenant unlinked with no error to notice.
		await this.update(tenant.id, { stripeCustomerId } as Partial<Tenant>);
		tenant.stripeCustomerId = stripeCustomerId;
	}

	/**
	 * Executes a set of update tasks for a given tenant in parallel.
	 *
	 * @param tenant An instance of the Tenant class.
	 * @returns Promise<void>
	 */
	public async executeTenantUpdateTasks(tenant: Tenant): Promise<void> {
		try {
			await Promise.all([
				// 1. Create Enabled/Disabled features for relative tenants.
				this.commandBus.execute(new TenantFeatureOrganizationCreateCommand([tenant])),

				// 2. Create Default task statuses for relative tenants.
				this.commandBus.execute(new TenantStatusBulkCreateCommand([tenant])),

				// 3. Create default task sizes for relative tenants.
				this.commandBus.execute(new TenantTaskSizeBulkCreateCommand([tenant])),

				// 4. Create default task priorities for relative tenants.
				this.commandBus.execute(new TenantTaskPriorityBulkCreateCommand([tenant])),

				// 5. Create default issue types for relative tenants.
				this.commandBus.execute(new TenantIssueTypeBulkCreateCommand([tenant]))
			]);

			// 6. Initialize default settings for the new tenant, including file storage provider.
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
					entityType: this.typeOrmTenantRepository?.metadata?.tableName ?? 'tenant',
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
							entityType: this.typeOrmUserRepository?.metadata?.tableName ?? 'user',
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
