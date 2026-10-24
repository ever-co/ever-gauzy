/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before anything applies `@IsEmployeeBelongsToOrganization()`. See the note
 * in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { UnauthorizedException } from '@nestjs/common';
import { LanguagesEnum } from '@gauzy/contracts';
import { Column, DataSource, Entity, PrimaryColumn, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { SIGNUP_EMAIL_VERIFICATION_ENV, signupRequiresEmailVerification } from './signup-email-verification';

/**
 * Owner decision 4: a self-registered account stays inactive until its e-mail link is clicked.
 *
 * Self-registration = `register()` with no invitation and no tenant. It is created inactive, so every sign-in path
 * (they all read active users only) refuses it, and the confirmation link activates it. Invited users are confirmed by
 * the invitation, accounts an admin creates name a tenant, and accounts that already exist are never touched: the
 * activation matches only the waiting state (inactive, no tenant, never confirmed).
 */

const TENANT_ID = '5e000000-0000-4000-8000-00000000000a';
const ORGANIZATION_ID = '5e000000-0000-4000-8000-0000000000a1';
const INVITE_ID = '5e000000-0000-4000-8000-0000000000c1';
const NEW_USER_ID = '5e000000-0000-4000-8000-0000000000e1';

/** An AuthService wired with only what `register()` touches; `created` records what the user row was built from. */
function buildRegisterService({ verificationEnabled = true } = {}) {
	const created: any[] = [];
	const service: any = Object.create(AuthService.prototype);
	service.ormType = MultiORMEnum.TypeORM;
	service.typeOrmUserRepository = {
		create: jest.fn((plain: any) => {
			created.push(plain);
			return { ...plain };
		}),
		save: jest.fn(async (entity: any) => ({ id: NEW_USER_ID, ...entity })),
		update: jest.fn().mockResolvedValue(undefined),
		findOne: jest.fn(async () => ({ id: NEW_USER_ID, ...created[created.length - 1] })),
		metadata: { tableName: 'user' }
	};
	service.typeOrmEmployeeRepository = { create: jest.fn((plain) => plain), save: jest.fn(async (e) => e) };
	service.passwordHashService = { hash: jest.fn(async () => '$2b$10$server-side') };
	service.userOrganizationService = { addUserToOrganization: jest.fn().mockResolvedValue(undefined) };
	service.emailConfirmationService = {
		sendEmailVerification: jest.fn(),
		isEmailVerificationEnabled: jest.fn(async () => verificationEnabled)
	};
	service.emailService = { welcomeUser: jest.fn() };
	service.eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
	service.termsAcceptanceService = { assertClaimsArePublished: jest.fn(), record: jest.fn() };
	service.commandBus = { execute: jest.fn() };
	service.userService = { findOneByIdString: jest.fn() };
	service.logger = { error: jest.fn(), warn: jest.fn() };
	return { service: service as AuthService, created, raw: service };
}

const selfRegistration = (user: Record<string, unknown> = {}) =>
	({ user: { firstName: 'Ada', email: 'ada@example.com', ...user }, password: 'correct-horse' }) as any;

describe('signupRequiresEmailVerification', () => {
	const previous = process.env[SIGNUP_EMAIL_VERIFICATION_ENV];
	afterEach(() => {
		if (previous === undefined) delete process.env[SIGNUP_EMAIL_VERIFICATION_ENV];
		else process.env[SIGNUP_EMAIL_VERIFICATION_ENV] = previous;
	});

	it.each([
		[undefined, true],
		['', true],
		['true', true],
		['false', false],
		[' FALSE ', false]
	])('%p reads as %p', (value, expected) => {
		if (value === undefined) delete process.env[SIGNUP_EMAIL_VERIFICATION_ENV];
		else process.env[SIGNUP_EMAIL_VERIFICATION_ENV] = value;
		expect(signupRequiresEmailVerification()).toBe(expected);
	});
});

describe('AuthService.register — a self-registration waits, inactive, for its e-mail confirmation', () => {
	const previous = process.env[SIGNUP_EMAIL_VERIFICATION_ENV];

	beforeEach(() => {
		delete process.env[SIGNUP_EMAIL_VERIFICATION_ENV];
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue(null as any);
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue(null as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		if (previous === undefined) delete process.env[SIGNUP_EMAIL_VERIFICATION_ENV];
		else process.env[SIGNUP_EMAIL_VERIFICATION_ENV] = previous;
	});

	it('creates a self-registration inactive and sends its verification e-mail', async () => {
		const { service, created, raw } = buildRegisterService();

		const user = await service.register(selfRegistration(), LanguagesEnum.ENGLISH);

		expect(created[0]).toMatchObject({ email: 'ada@example.com', isActive: false });
		expect(user.isActive).toBe(false);
		expect(raw.emailConfirmationService.sendEmailVerification).toHaveBeenCalledTimes(1);
	});

	it('keeps it inactive when the body asks for an active account', async () => {
		const { service, created } = buildRegisterService();

		await service.register(selfRegistration({ isActive: true }), LanguagesEnum.ENGLISH);

		expect(created[0].isActive).toBe(false);
	});

	it('creates an active account when the deployment set SIGNUP_EMAIL_VERIFICATION_REQUIRED=false', async () => {
		process.env[SIGNUP_EMAIL_VERIFICATION_ENV] = 'false';
		const { service, created, raw } = buildRegisterService();

		await service.register(selfRegistration(), LanguagesEnum.ENGLISH);

		expect(created[0].isActive).toBeUndefined();
		expect(raw.emailConfirmationService.isEmailVerificationEnabled).not.toHaveBeenCalled();
		// The verification e-mail still goes out.
		expect(raw.emailConfirmationService.sendEmailVerification).toHaveBeenCalledTimes(1);
	});

	it('creates an active account while FEATURE_EMAIL_VERIFICATION is off (nothing could ever activate it)', async () => {
		const { service, created } = buildRegisterService({ verificationEnabled: false });

		await service.register(selfRegistration(), LanguagesEnum.ENGLISH);

		expect(created[0].isActive).toBeUndefined();
	});

	it('leaves an invited user active and confirmed by the invitation', async () => {
		const { service, created, raw } = buildRegisterService();

		await service.register(
			{
				...selfRegistration({ tenant: { id: TENANT_ID } }),
				organizationId: ORGANIZATION_ID,
				inviteId: INVITE_ID
			},
			LanguagesEnum.ENGLISH
		);

		expect(created[0].isActive).toBeUndefined();
		expect(raw.emailConfirmationService.isEmailVerificationEnabled).not.toHaveBeenCalled();
		expect(raw.typeOrmUserRepository.update).toHaveBeenCalledWith(
			NEW_USER_ID,
			expect.objectContaining({ emailVerifiedAt: expect.anything() })
		);
	});

	it('leaves an account an admin creates in their tenant active', async () => {
		const { service, created } = buildRegisterService();

		await service.register(selfRegistration({ tenant: { id: TENANT_ID } }), LanguagesEnum.ENGLISH);

		expect(created[0].isActive).toBeUndefined();
	});
});

/** The `user` columns the sign-in and confirmation paths read, on a real better-sqlite3 database. */
@Entity('signup_verification_user')
class FixtureUser {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar')
	email: string;

	@Column('varchar', { nullable: true })
	hash?: string | null;

	@Column('varchar', { nullable: true })
	tenantId?: string | null;

	@Column('boolean', { nullable: true })
	isActive?: boolean | null;

	@Column('boolean', { nullable: true, default: false })
	isArchived?: boolean | null;

	@Column({ type: 'datetime', nullable: true })
	emailVerifiedAt?: Date | null;

	@Column({ type: 'varchar', nullable: true })
	emailToken?: string | null;

	@Column({ type: 'varchar', nullable: true })
	code?: string | null;

	@Column({ type: 'datetime', nullable: true })
	codeExpireAt?: Date | null;
}

describe('a waiting self-registration: refused at sign-in, activated by its confirmation link', () => {
	let dataSource: DataSource;
	let users: Repository<FixtureUser>;

	const PENDING = 'u-pending';
	const DEACTIVATED = 'u-deactivated';
	const UNVERIFIED = 'u-existing-unverified';

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [FixtureUser],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		users = dataSource.getRepository(FixtureUser);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await users.clear();
		await users.insert([
			// Registered on /auth/register, never confirmed.
			{ id: PENDING, email: 'ada@example.com', hash: 'h', tenantId: null, isActive: false },
			// Deactivated by an admin of their tenant before confirming the address.
			{ id: DEACTIVATED, email: 'bob@example.com', hash: 'h', tenantId: TENANT_ID, isActive: false },
			// An account that existed before the decision and never confirmed its address.
			{ id: UNVERIFIED, email: 'cyd@example.com', hash: 'h', tenantId: TENANT_ID, isActive: true }
		]);
	});

	const stored = (id: string) => users.findOneByOrFail({ id });

	function buildUserService() {
		const service: UserService = Object.create(UserService.prototype);
		// `ormType` is a getter on `CrudService`: define it on the instance, an assignment throws.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		Object.assign(service, { typeOrmRepository: users });
		return service;
	}

	it('POST /auth/login refuses the waiting account even with the right password', async () => {
		const attempt = { fail: jest.fn(), succeed: jest.fn(), release: jest.fn() };
		const service: AuthService = Object.create(AuthService.prototype);
		Object.assign(service, {
			loginAttemptService: { begin: jest.fn(async () => attempt) },
			logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
			passwordHashService: { verify: jest.fn(async () => true), needsRehash: jest.fn(() => false) },
			// The query `login()` runs, against the real rows.
			userService: { find: jest.fn(async ({ where }) => users.find({ where })) }
		});

		await expect(service.login({ email: 'ada@example.com', password: 'right' })).rejects.toBeInstanceOf(
			UnauthorizedException
		);
	});

	it('the confirmation link activates the waiting account and records the confirmation', async () => {
		await expect(buildUserService().markEmailAsVerified(PENDING, 'ada@example.com')).resolves.toBe(true);

		expect(await stored(PENDING)).toMatchObject({ isActive: true, emailVerifiedAt: expect.any(Date) });
	});

	it('a confirmation for an address the account no longer holds activates nothing', async () => {
		await expect(buildUserService().markEmailAsVerified(PENDING, 'old@example.com')).resolves.toBe(false);

		expect(await stored(PENDING)).toMatchObject({ isActive: false, emailVerifiedAt: null });
	});

	it('never re-activates an account an admin deactivated', async () => {
		await expect(buildUserService().markEmailAsVerified(DEACTIVATED, 'bob@example.com')).resolves.toBe(true);

		expect(await stored(DEACTIVATED)).toMatchObject({ isActive: false, emailVerifiedAt: expect.any(Date) });
	});

	it('leaves an existing unconfirmed account as it was, apart from the confirmation', async () => {
		await expect(buildUserService().markEmailAsVerified(UNVERIFIED, 'cyd@example.com')).resolves.toBe(true);

		expect(await stored(UNVERIFIED)).toMatchObject({ isActive: true, emailVerifiedAt: expect.any(Date) });
	});
});
