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
	async linkStripeCustomer(tenant: ITenant, user: IUser): Promise<string | null> {
		if (!this.stripeSubscriptionService.isBillingEnforced()) return null;
		if (!user?.email || !tenant?.id) return null;

		// An address is only evidence of who someone is once they have proved they receive mail at it,
		// and until then this link must not be made.
		//
		// The attack it prevents: email is NOT unique in this platform — `login()` deliberately loads
		// every user with a given address and tries the password against each, to support one person
		// holding accounts in several tenants. So an attacker who knows that alice@corp.com has paid
		// can register a second account under that same address, satisfy the registration paywall with
		// Alice's subscription, create their own tenant, and — without this check — have Alice's Stripe
		// customer written onto it. From there every /billing route resolves to Alice's account: her
		// invoices and card details are readable, her plan can be changed (charging her card a
		// proration immediately), her subscription can be cancelled, and a full Stripe customer-portal
		// session can be opened against it. Nothing in Alice's own product would show that it happened.
		//
		// Verification is the cheap and decisive answer, because the one thing the attacker cannot do
		// is read Alice's mail. A genuine buyer is simply linked slightly later — see
		// `ensureStripeCustomerLink`, which completes the link on their first visit to the billing page
		// once they have confirmed the address.
		if (!user.emailVerifiedAt) {
			return null;
		}

		const stripeCustomerId = await this.stripeSubscriptionService.findCustomerIdForEmail(user.email);
		if (!stripeCustomerId) return null;

		// Second line of defense, independent of the first: never adopt a customer that some other
		// tenant already bills through. Two tenants pointing at one Stripe customer is never something
		// we want, however it came about.
		const claimedBy = await this.typeOrmTenantRepository.findOne({
			where: { stripeCustomerId },
			select: { id: true }
		});
		if (claimedBy && claimedBy.id !== tenant.id) {
			console.warn(
				`Refusing to link tenant ${tenant.id} to a Stripe customer already held by tenant ${claimedBy.id}.`
			);
			return null;
		}

		// Through CrudService rather than the TypeORM repository directly: this class is multi-ORM, and
		// writing straight to typeOrmTenantRepository would silently do nothing on a deployment running
		// DB_ORM=mikro-orm, leaving the tenant unlinked with no error to notice.
		await this.update(tenant.id, { stripeCustomerId } as Partial<Tenant>);
		tenant.stripeCustomerId = stripeCustomerId;
		return stripeCustomerId;
	}

	/**
	 * Complete a tenant's Stripe link on demand, for a tenant that has none yet.
	 *
	 * Onboarding cannot always make the link, because at that moment the buyer has usually not yet
	 * confirmed their email — the verification message has only just been sent. Rather than lower the
	 * bar there, the link is simply made later: the first time someone opens the billing page after
	 * confirming their address, this resolves it.
	 *
	 * Returns the customer id if a link now exists, or null. Never throws — a tenant with no link is a
	 * normal state that the caller reports as "not linked", not an error.
	 */
	async ensureStripeCustomerLink(tenantId: string, userId: string): Promise<string | null> {
		if (!this.stripeSubscriptionService.isBillingEnforced()) return null;
		if (!tenantId || !userId) return null;

		try {
			const [tenant, user] = await Promise.all([
				this.typeOrmTenantRepository.findOne({
					where: { id: tenantId },
					select: { id: true, stripeCustomerId: true }
				}),
				this.typeOrmUserRepository.findOne({
					where: { id: userId },
					select: { id: true, email: true, emailVerifiedAt: true, tenantId: true }
				})
			]);

			if (!tenant || !user) return null;
			if (tenant.stripeCustomerId?.trim()) return tenant.stripeCustomerId.trim();

			// The caller must belong to the tenant being linked. RequestContext already scopes the
			// request, but this method takes both ids, so it verifies rather than assumes.
			if (user.tenantId !== tenantId) return null;

			return await this.linkStripeCustomer(tenant as ITenant, user as IUser);
		} catch (error) {
			console.warn('Could not resolve a Stripe customer for this tenant:', (error as Error)?.message);
			return null;
		}
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
