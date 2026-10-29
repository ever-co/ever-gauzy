import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	FileStorageProviderEnum,
	ID,
	ITenant,
	ITenantCreateInput,
	ITenantUpdateInput,
	IUser,
	RolesEnum
} from '@gauzy/contracts';
import { DataSource, IsNull, Not, UpdateResult } from 'typeorm';
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
import { ImageAsset } from '../image-asset/image-asset.entity';
import {
	IssueType,
	Organization,
	TaskPriority,
	TaskSize,
	TaskStatus,
	TenantSetting,
	User
} from '../core/entities/internal';
import { Tenant } from './tenant.entity';
import { StripeSubscriptionService, describeError } from '../shared/billing/stripe-subscription.service';

@Injectable()
export class TenantService extends CrudService<Tenant> {
	static readonly ONBOARDING_IN_PROGRESS =
		'Your workspace is already being set up. Please wait a moment and try again.';

	/** Creators onboarding in this process right now: the onboarding lock where the database offers none. */
	private static readonly onboardingInProgress = new Set<ID>();

	/** Onboardings of this process holding a lock connection, and those waiting for one (see `withOnboardingLock`). */
	private static lockConnectionsInUse = 0;
	private static readonly lockConnectionWaiters: Array<() => void> = [];

	private readonly logger = new Logger(TenantService.name);
	private readonly billingLogger = new Logger('TenantBillingLink');

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

		// The Checkout Session id is a one-time proof of purchase, not a tenant attribute: take it out
		// of the payload so it can never be spread into the entity, and use it below once the creator
		// holds the tenant's SUPER_ADMIN role.
		const { stripeCheckoutSessionId, ...tenantInput } = entity;

		// Everything from choosing the tenant to linking its creator runs under the creator's onboarding lock.
		const tenant = await this.withOnboardingLock(user, () => this.createOrResumeTenant(tenantInput, user));

		// Record which Stripe customer this tenant bills through, if that can be established safely now.
		// A buyer arriving from the shared checkout brings their Checkout Session, which proves the
		// purchase outright; anyone else is linked by verified email, which at this moment usually does
		// nothing (the confirmation mail has only just gone out) and is completed on their first visit to
		// the billing page instead. Best-effort: never fails the onboarding around it.
		await this.linkStripeCustomerAtOnboarding(tenant, user, stripeCheckoutSessionId);

		// Create Import Records while migrating for relative tenant.
		await this.importRecords(entity, tenant, user);

		console.timeEnd('On Boarding Tenant');
		return tenant;
	}

	/**
	 * Creates the creator's tenant, or finishes the one an earlier, failed attempt left behind, seeds it and
	 * links the creator to it as SUPER_ADMIN. Runs under the creator's onboarding lock.
	 *
	 * Every seed is awaited and its failure propagates before the creator is linked: a tenant whose seeding
	 * failed stays unlinked, so the creator's retry finds it with {@link findUnfinishedTenant} and completes it.
	 *
	 * @param input - The tenant details, without the Checkout Session id.
	 * @param user - The creator.
	 * @throws BadRequestException when the creator already has a tenant: a second request (a double submit, a
	 * retry while the first attempt was still running) that passed the route's check before the first one linked
	 * the creator.
	 */
	private async createOrResumeTenant(input: ITenantCreateInput, user: IUser): Promise<Tenant> {
		if (await this.userHasTenant(user)) {
			throw new BadRequestException('Tenant already exists');
		}

		// A failed attempt can leave behind a tenant that was created but never linked to its creator, and
		// the creator, still without a tenant, is sent back here. Finish that tenant instead of creating
		// another one: every retry used to leave one more empty tenant behind.
		const unfinished = await this.findUnfinishedTenant(user);
		const onlyMissing = !!unfinished;

		// Creates and saves a tenant entity from the given details. The creator is stated here, not left to the base
		// subscriber alone: under MikroORM `createdByUserId` is a mirror (`persist: false`) that is stored only through
		// the `createdByUser` relation `create` derives from the input, so the creator would otherwise not be recorded.
		const tenant = unfinished
			? await this.resumeUnfinishedTenant(unfinished, input)
			: await this.create({ ...input, createdByUserId: user.id } as Partial<Tenant>);

		// Create Role/Permissions to relative tenants. An unfinished tenant gets only the ones it is missing.
		await this.commandBus.execute(new TenantRoleBulkCreateCommand([tenant], { onlyMissing }));

		// Executes Runs update tasks for the newly created tenant.
		await this.executeTenantUpdateTasks(tenant, { onlyMissing, throwOnError: true });

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

		return tenant;
	}

	/**
	 * Runs `work` while holding the creator's onboarding lock, so that two onboardings of one user (a double
	 * submit, a retry while the first attempt is still running), on any API pod, never both choose or create
	 * a tenant. The lock is not waited for: the second request is refused at once.
	 *
	 * - Postgres: a transaction-scoped advisory lock, taken on a connection of its own whose transaction
	 *   writes nothing and ends (releasing the lock) when `work` settles or the connection drops.
	 * - MySQL: a named lock (`GET_LOCK`) on a connection of its own, released when `work` settles.
	 * - SQLite and MikroORM: an in-process guard. These setups run a single API process.
	 *
	 * The lock's connection comes from the pool `work` draws on, so a process lets only a few onboardings hold one
	 * at a time (see {@link lockConnectionSlots}); the others wait for a slot, holding no connection meanwhile.
	 * Without that bound, enough simultaneous signups would each hold a lock connection while waiting for a
	 * connection to work with, and none could finish. A pool too small to spare one uses the in-process guard.
	 *
	 * @param user - The creator.
	 * @param work - Everything from choosing the tenant to linking the creator.
	 * @throws ConflictException when another onboarding of the same user holds the lock.
	 */
	private async withOnboardingLock<T>(user: IUser, work: () => Promise<T>): Promise<T> {
		const key = `tenant-onboarding:${user.id}`;
		const dataSource = this.ormType === MultiORMEnum.TypeORM ? this.typeOrmRepository?.manager?.dataSource : null;
		const type = dataSource?.options.type;
		const slots = TenantService.lockConnectionSlots(dataSource?.options);

		if ((type === 'postgres' || type === 'mysql') && slots > 0) {
			await TenantService.takeLockConnectionSlot(slots);
			try {
				return await this.withDatabaseLock(dataSource, type, key, work);
			} finally {
				TenantService.releaseLockConnectionSlot();
			}
		}

		if (TenantService.onboardingInProgress.has(user.id)) {
			throw new ConflictException(TenantService.ONBOARDING_IN_PROGRESS);
		}
		TenantService.onboardingInProgress.add(user.id);
		try {
			return await work();
		} finally {
			TenantService.onboardingInProgress.delete(user.id);
		}
	}

	/**
	 * How many onboardings of this process may hold a lock connection at once: half the pool, at most 4, so the
	 * lock connections never take the connections their own work needs (nor most of the pool from the rest of the
	 * API). 0 for a pool of one connection.
	 *
	 * @param options - The data source's options (`poolSize`, or the driver's own `extra.max`).
	 */
	private static lockConnectionSlots(options?: { poolSize?: number; extra?: { max?: number } }): number {
		const poolSize = Number(options?.poolSize ?? options?.extra?.max ?? 10);
		return Number.isFinite(poolSize) ? Math.max(0, Math.min(4, Math.floor(poolSize / 2))) : 0;
	}

	/** Waits until fewer than `slots` onboardings of this process hold a lock connection, then takes a slot. */
	private static async takeLockConnectionSlot(slots: number): Promise<void> {
		while (TenantService.lockConnectionsInUse >= slots) {
			await new Promise<void>((resolve) => TenantService.lockConnectionWaiters.push(resolve));
		}
		TenantService.lockConnectionsInUse++;
	}

	/** Gives a slot back and wakes the next onboarding waiting for one. */
	private static releaseLockConnectionSlot(): void {
		TenantService.lockConnectionsInUse--;
		TenantService.lockConnectionWaiters.shift()?.();
	}

	/**
	 * Runs `work` holding the database lock named `key` on a connection of its own (see {@link withOnboardingLock}).
	 *
	 * @throws ConflictException when the lock is held.
	 */
	private async withDatabaseLock<T>(
		dataSource: DataSource,
		type: 'postgres' | 'mysql',
		key: string,
		work: () => Promise<T>
	): Promise<T> {
		const runner = dataSource.createQueryRunner();
		await runner.connect();
		try {
			if (type === 'postgres') {
				await runner.startTransaction();
				try {
					// The transaction sits idle while `work` runs on other connections: a server-side
					// `idle_in_transaction_session_timeout` would end the session, and the lock with it, mid-onboarding.
					await runner.query('SET LOCAL idle_in_transaction_session_timeout = 0');
					const [row] = await runner.query(
						`SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS "acquired"`,
						[key]
					);
					if (!row?.acquired) {
						throw new ConflictException(TenantService.ONBOARDING_IN_PROGRESS);
					}
					return await work();
				} finally {
					// The transaction wrote nothing: ending it only releases the lock. If it cannot be ended
					// the connection is gone, and the lock went with its session.
					await runner.rollbackTransaction().catch((error) => {
						this.logger.warn(`The onboarding lock's transaction could not be ended: ${error?.message}`);
					});
				}
			}

			// GET_LOCK names are at most 64 characters: `gauzy:tenant-onboarding:<uuid>` is 60.
			const name = `gauzy:${key}`;
			const [row] = await runner.query('SELECT GET_LOCK(?, 0) AS `acquired`', [name]);
			if (Number(row?.acquired) !== 1) {
				throw new ConflictException(TenantService.ONBOARDING_IN_PROGRESS);
			}
			try {
				return await work();
			} finally {
				await runner.query('SELECT RELEASE_LOCK(?)', [name]);
			}
		} finally {
			await runner.release();
		}
	}

	/**
	 * Whether the user belongs to a tenant now, read from the database rather than from the request: the
	 * request's copy was loaded before any onboarding running alongside it could link the user.
	 *
	 * @param user - The creator.
	 */
	private async userHasTenant(user: IUser): Promise<boolean> {
		// A count is always answered by the database: MikroORM's `findOne` could hand back the user its identity map
		// cached when the request was authenticated.
		return this.ormType === MultiORMEnum.MikroORM
			? (await this.mikroOrmUserRepository.count(
					{ id: user.id, tenant: { $ne: null } } as any,
					{ filters: false } as any
				)) > 0
			: await this.typeOrmUserRepository.exists({
					where: { id: user.id, tenantId: Not(IsNull()) },
					withDeleted: true
				});
	}

	/**
	 * The newest tenant this user created whose onboarding never finished, or null.
	 *
	 * Onboarding creates the tenant, then its roles and default rows, then links the creator to it as
	 * SUPER_ADMIN. When a step after the first one fails (production 2026-10-27: every signup timed out
	 * connecting to the database, see the Jitsu plugin's BoundedEventQueue), the tenant stays behind with
	 * nobody in it and the creator, still without a tenant, is sent back to onboarding. Only the user who
	 * created such a tenant can finish it, and finishing it is safe because nobody else can have used it.
	 *
	 * A tenant counts as unfinished when the user created it and no user and no organization (deleted ones
	 * included) belong to it. Whatever roles, permissions and default rows it holds are completed by the
	 * seeding steps, which add only what is missing.
	 *
	 * Every tenant the user created is considered, newest first: a cap taken before qualifying them could
	 * hide the one that qualifies behind newer tenants that do not.
	 *
	 * @param user - The user being onboarded.
	 */
	async findUnfinishedTenant(user: IUser): Promise<Tenant | null> {
		// Under MikroORM nothing is resumed and a retry creates a new tenant, as before: MikroORM writes a seed's rows
		// one by one, outside a common transaction, so a row the seed left behind does not prove the seed completed.
		if (!user?.id || this.ormType === MultiORMEnum.MikroORM) return null;

		const candidates = await this.find({
			where: { createdByUserId: user.id },
			order: { createdAt: 'DESC' }
		});

		for (const candidate of candidates ?? []) {
			if (await this.tenantHasRows(User, candidate.id)) continue;
			if (await this.tenantHasRows(Organization, candidate.id)) continue;
			return candidate;
		}
		return null;
	}

	/**
	 * Gives an unfinished tenant the name, logo and image of the attempt that finishes it, through
	 * {@link updateProfile} like any other change to a tenant's profile: an `imageId` must name an image of
	 * this tenant, and an explicit null clears the image. An omitted logo or image leaves it as it is.
	 *
	 * @param tenant - A tenant returned by {@link findUnfinishedTenant}.
	 * @param input - The tenant details of this attempt.
	 */
	private async resumeUnfinishedTenant(tenant: Tenant, input: ITenantCreateInput): Promise<Tenant> {
		const changes: ITenantUpdateInput = { name: input.name };
		if (input.logo !== undefined) changes.logo = input.logo;
		if (input.imageId !== undefined) changes.imageId = input.imageId;

		await this.updateProfile(tenant.id, changes);

		// Read back, so the image relation and the logo derived from it are the ones now stored, not the earlier
		// attempt's.
		return (await this.findOneByIdString(tenant.id)) ?? Object.assign(tenant, changes);
	}

	/**
	 * Whether any row of `entity` belongs to the tenant, soft-deleted rows included.
	 *
	 * @param entity - An entity with a `tenantId` column.
	 * @param tenantId - The tenant.
	 */
	private async tenantHasRows(entity: new (...args: any[]) => unknown, tenantId: ID): Promise<boolean> {
		const where = { tenantId };
		return this.ormType === MultiORMEnum.MikroORM
			? (await this.mikroOrmRepository
					.getEntityManager()
					.count(entity as any, where as any, { filters: false })) > 0
			: await this.typeOrmRepository.manager
					.getRepository(entity)
					.exists({ where: where as any, withDeleted: true });
	}

	/**
	 * Link a freshly created tenant to its Stripe customer: from the creator's Checkout Session when
	 * they brought one, otherwise by verified email. Never throws — onboarding must not fail because a
	 * payments provider, or a race on the unique link index, had a bad moment.
	 */
	async linkStripeCustomerAtOnboarding(
		tenant: ITenant,
		user: IUser,
		stripeCheckoutSessionId?: string
	): Promise<string | null> {
		try {
			if (stripeCheckoutSessionId) {
				const linked = await this.linkStripeCustomerFromCheckoutSession(tenant, user, stripeCheckoutSessionId);
				if (linked) return linked;
			}
			return await this.linkStripeCustomer(tenant, user);
		} catch (error) {
			this.billingLogger.warn(
				`Could not link tenant ${tenant?.id} to a Stripe customer: ${describeError(error)}`
			);
			return null;
		}
	}

	/**
	 * Link a new tenant to the Stripe customer of the Checkout Session its creator completed.
	 *
	 * This is the proven-identity path, and the reason a buyer no longer has to confirm their email
	 * before their tenant is linked. Only the browser that completed the checkout holds the session id,
	 * and `verifyCheckoutSession` confirms with Stripe that the session is complete, is a subscription
	 * to this deployment's product, is recent, and was paid under the creator's OWN address. The
	 * creator has just become this tenant's SUPER_ADMIN, so the link goes to the tenant they own.
	 *
	 * Never adopts a customer another tenant already holds. Logs exactly one line with the outcome
	 * (`session-linked` or the reason it was declined), with ids only.
	 */
	async linkStripeCustomerFromCheckoutSession(
		tenant: ITenant,
		user: IUser,
		stripeCheckoutSessionId: string
	): Promise<string | null> {
		if (!this.stripeSubscriptionService.isBillingEnforced()) return null;
		if (!tenant?.id || !user?.email) return null;

		const log = (decision: string, customerId?: string, detail?: string) =>
			this.billingLogger.log(
				`stripe-link ${JSON.stringify({
					source: 'checkout-session',
					product: this.stripeSubscriptionService.billingProduct,
					decision,
					tenant: tenant.id,
					customer: customerId,
					detail
				})}`
			);

		const verification = await this.stripeSubscriptionService.verifyCheckoutSession(
			stripeCheckoutSessionId,
			user.email
		);
		if (verification.ok === false) {
			log('session-declined', undefined, verification.reason);
			return null;
		}
		const { customerId } = verification;

		const claimedBy = await this.typeOrmTenantRepository.findOne({
			where: { stripeCustomerId: customerId },
			select: { id: true }
		});
		if (claimedBy && claimedBy.id !== tenant.id) {
			log('claimed', customerId, `held-by:${claimedBy.id}`);
			return null;
		}
		if (tenant.stripeCustomerId && tenant.stripeCustomerId !== customerId) {
			log('already-linked', customerId);
			return null;
		}

		// Through CrudService, for the same multi-ORM reason as linkStripeCustomer below.
		await this.update(tenant.id, { stripeCustomerId: customerId } as Partial<Tenant>);
		tenant.stripeCustomerId = customerId;
		log('session-linked', customerId);
		return customerId;
	}

	/**
	 * Records which Stripe customer a tenant bills through, when that can be established safely.
	 *
	 * Storing the id — rather than looking the buyer up by email on every call — is what keys later
	 * billing on something stable: an address can be changed, and Stripe permits several customers to
	 * share one, so an email cannot identify a billing account on its own.
	 *
	 * Establishing the link at all requires a **verified** address; see the reasoning inline. At
	 * onboarding that is usually not yet true, since the confirmation mail has only just gone out, so
	 * most genuine buyers are linked slightly later by `ensureStripeCustomerLink()` instead. Returns
	 * the customer id when a link now exists, or null.
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
	 * Updates a tenant's name and logo.
	 *
	 * Under MikroORM `imageId` is a read-only mirror of the `image` relation (`relationId` columns are
	 * `persist: false`, see `column.helper.ts`), so a plain `update({ imageId })` leaves the logo
	 * unchanged there. Write the relation instead; `null` clears it. TypeORM writes the column directly.
	 *
	 * A new logo must be an image asset of this tenant: an asset id is a bare UUID, and without the check a
	 * Super Admin could point their tenant's logo at another tenant's upload.
	 *
	 * @param id - The tenant to update.
	 * @param input - The new name and logo; an omitted `imageId` leaves the image as it is.
	 * @throws BadRequestException when `imageId` names an image asset outside the tenant.
	 */
	async updateProfile(id: ID, input: ITenantUpdateInput): Promise<ITenant | UpdateResult> {
		const { imageId, ...rest } = input;
		if (imageId === undefined) {
			return await this.update(id, rest);
		}
		if (imageId) {
			await this.assertImageInTenant(imageId, id);
		}
		if (this.ormType === MultiORMEnum.MikroORM) {
			// MikroORM's nativeUpdate takes the related row's primary key for a many-to-one.
			const row: Record<string, unknown> = { ...rest, image: imageId ?? null };
			return await this.update(id, row as Partial<Tenant>);
		}
		return await this.update(id, { ...rest, imageId });
	}

	/**
	 * Refuses an image asset that does not belong to the given tenant.
	 *
	 * @param imageId - The image asset the tenant's logo would point at.
	 * @param tenantId - The tenant being updated.
	 * @throws BadRequestException when no image asset with that id belongs to the tenant.
	 */
	private async assertImageInTenant(imageId: ID, tenantId: ID): Promise<void> {
		const where = { id: imageId, tenantId };
		const exists =
			this.ormType === MultiORMEnum.MikroORM
				? (await this.mikroOrmRepository.getEntityManager().count(ImageAsset, where)) > 0
				: await this.typeOrmRepository.manager.getRepository(ImageAsset).existsBy(where);
		if (!exists) {
			throw new BadRequestException('The image does not belong to this tenant.');
		}
	}

	/**
	 * Executes a set of update tasks for a given tenant in parallel.
	 *
	 * @param tenant An instance of the Tenant class.
	 * @param options.onlyMissing - Create only the rows the tenant does not have yet: for a tenant an earlier,
	 * failed onboarding already created, where some of the tasks may have run. Each task below writes its rows in
	 * one save, so a tenant has all of a task's rows or none of them; feature toggles are completed pair by pair
	 * instead, because a migration gives every tenant some of them.
	 * @param options.throwOnError - Throw the first failure (once every task has settled) instead of logging it.
	 * @returns Promise<void>
	 */
	public async executeTenantUpdateTasks(
		tenant: Tenant,
		options: { onlyMissing?: boolean; throwOnError?: boolean } = {}
	): Promise<void> {
		const onlyMissing = !!options.onlyMissing;

		// Each check and its seed run as one task, so a seed that fails is always awaited by someone.
		const seed = async (entity: new (...args: any[]) => unknown, run: () => Promise<unknown>) => {
			if (onlyMissing && (await this.tenantHasRows(entity, tenant.id))) return;
			await run();
		};

		try {
			// Every task is started at once and all of them settle before this goes on, so none is still writing
			// when a failure is reported (and the creator retries).
			const results = await Promise.allSettled([
				// 1. Create Enabled/Disabled features for relative tenants.
				this.commandBus.execute(new TenantFeatureOrganizationCreateCommand([tenant], { onlyMissing })),

				// 2. Create Default task statuses for relative tenants.
				seed(TaskStatus, () => this.commandBus.execute(new TenantStatusBulkCreateCommand([tenant]))),

				// 3. Create default task sizes for relative tenants.
				seed(TaskSize, () => this.commandBus.execute(new TenantTaskSizeBulkCreateCommand([tenant]))),

				// 4. Create default task priorities for relative tenants.
				seed(TaskPriority, () => this.commandBus.execute(new TenantTaskPriorityBulkCreateCommand([tenant]))),

				// 5. Create default issue types for relative tenants.
				seed(IssueType, () => this.commandBus.execute(new TenantIssueTypeBulkCreateCommand([tenant])))
			]);
			const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
			if (failure) {
				throw failure.reason;
			}

			// 6. Initialize default settings for the new tenant, including file storage provider.
			await seed(TenantSetting, () => this.initializeTenantSettings(tenant));
		} catch (error) {
			if (options.throwOnError) {
				throw error;
			}
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
