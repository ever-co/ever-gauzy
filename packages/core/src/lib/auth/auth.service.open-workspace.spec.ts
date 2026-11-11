/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `user.email-lookup.spec.ts` for the cycle it avoids).
 */
import '../core/entities/internal';

import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Column, CreateDateColumn, DataSource, Entity, IsNull, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntitlementResult } from '../shared/billing/stripe-subscription.service';
import { WORKSPACE_ADDRESS_UNPROVEN_MESSAGE, WORKSPACE_SUBSCRIPTION_REQUIRED_MESSAGE } from './open-workspace';

/**
 * ever-co/ever-teams#5025: a signed-in person opens another workspace without signing out. `POST /auth/workspaces`
 * answers the account the workspace is created with (their address in no tenant yet, without a password), as a
 * workspace sign-in token the app exchanges at `/auth/signin.workspace` before it creates the tenant, the
 * organization and the first team through the sign-up routes.
 */

const PROVEN = new Date('2026-01-01T00:00:00.000Z');
const CALLER = {
	id: 'caller',
	email: 'ada@ever.co',
	tenantId: '11111111-1111-4111-8111-111111111111',
	firstName: 'Ada',
	lastName: 'Lovelace',
	imageUrl: 'https://images.example.com/ada.png',
	timeZone: 'Europe/Paris',
	preferredLanguage: 'fr',
	hash: 'the-caller-password-hash'
};

/** The user table's columns this path reads and writes. */
@Entity('open_workspace_user')
class FixtureUser {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('varchar')
	email: string;

	@Column('varchar', { nullable: true })
	firstName?: string | null;

	@Column('varchar', { nullable: true })
	lastName?: string | null;

	@Column('varchar', { nullable: true })
	imageUrl?: string | null;

	@Column('varchar', { nullable: true })
	timeZone?: string | null;

	@Column('varchar', { nullable: true })
	preferredLanguage?: string | null;

	@Column('varchar', { nullable: true })
	tenantId?: string | null;

	@Column('varchar', { nullable: true })
	hash?: string | null;

	@Column('boolean', { default: true })
	isActive?: boolean;

	@Column('boolean', { default: false })
	isArchived?: boolean;

	/** Left out of inserts, as on the real entity: written apart. */
	@Column({ type: 'datetime', nullable: true, insert: false })
	emailVerifiedAt?: Date | null;

	@CreateDateColumn()
	createdAt?: Date;
}

const logger = () => ({ error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() });

/** The workspace sign-in an answer carries, read as `/auth/signin.workspace` reads it. */
const signinOf = (service: AuthService, token: string) =>
	(service as unknown as { verifyToken(token: string): Record<string, unknown> }).verifyToken(token);

function signedInAs(user: { id: string; tenantId: string }) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);
	jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
}

describe('AuthService.openWorkspace, on a database', () => {
	let dataSource: DataSource;
	let users: Repository<FixtureUser>;
	let service: AuthService;

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

	/** Inserts the row, then writes the proof the insert leaves out. */
	async function seed(row: Partial<FixtureUser>) {
		const { emailVerifiedAt, ...fields } = row;
		const saved = await users.save(users.create(fields));
		if (emailVerifiedAt !== undefined) {
			await users.update({ id: saved.id }, { emailVerifiedAt });
		}
		return saved.id;
	}

	const unfinishedAccounts = () => users.find({ where: { email: CALLER.email, tenantId: IsNull(), hash: IsNull() } });

	beforeEach(async () => {
		await users.clear();
		await seed({ ...CALLER, emailVerifiedAt: PROVEN });
		// Only the collaborators this path touches; the rest of the constructor graph is irrelevant here.
		service = Object.create(AuthService.prototype);
		Object.assign(service, { ormType: 'typeorm', typeOrmUserRepository: users, logger: logger() });
		signedInAs({ id: CALLER.id, tenantId: CALLER.tenantId });
	});

	afterEach(() => jest.restoreAllMocks());

	it("opens an account for the caller's proven address: no tenant, no password, their name and settings", async () => {
		const opening = await service.openWorkspace();

		const [account] = await unfinishedAccounts();
		expect(account).toMatchObject({
			email: CALLER.email,
			firstName: CALLER.firstName,
			lastName: CALLER.lastName,
			imageUrl: CALLER.imageUrl,
			timeZone: CALLER.timeZone,
			preferredLanguage: CALLER.preferredLanguage,
			tenantId: null,
			hash: null,
			isActive: true,
			isArchived: false
		});
		// Proven as the caller's address is, although the insert leaves the column out
		expect(new Date(account.emailVerifiedAt as Date).toISOString()).toBe(PROVEN.toISOString());

		expect(opening.email).toBe(CALLER.email);
		expect(signinOf(service, opening.token)).toMatchObject({
			userId: account.id,
			email: CALLER.email,
			tenantId: null
		});
	});

	it('answers again the account an earlier attempt left without a workspace, rather than another one', async () => {
		const unfinished = await seed({ email: CALLER.email, emailVerifiedAt: PROVEN });

		const opening = await service.openWorkspace();

		expect(await unfinishedAccounts()).toHaveLength(1);
		expect(signinOf(service, opening.token)).toMatchObject({ userId: unfinished, tenantId: null });
	});

	it('proves the address of an unfinished account that was left without its proof, before answering it', async () => {
		const unfinished = await seed({ email: CALLER.email });

		await service.openWorkspace();

		const account = await users.findOneByOrFail({ id: unfinished });
		expect(new Date(account.emailVerifiedAt as Date).toISOString()).toBe(PROVEN.toISOString());
	});

	it('keeps no account when the proof cannot be written, and a retry opens one with its proof', async () => {
		jest.spyOn(Repository.prototype, 'update').mockRejectedValueOnce(new Error('connection lost'));

		await expect(service.openWorkspace()).rejects.toThrow('connection lost');
		expect(await unfinishedAccounts()).toHaveLength(0);

		await service.openWorkspace();
		const [account] = await unfinishedAccounts();
		expect(new Date(account.emailVerifiedAt as Date).toISOString()).toBe(PROVEN.toISOString());
	});

	it('opens one account for overlapping openings of the same address (a retry before the first answer)', async () => {
		const [first, second] = await Promise.all([service.openWorkspace(), service.openWorkspace()]);

		const accounts = await unfinishedAccounts();
		expect(accounts).toHaveLength(1);
		expect(signinOf(service, first.token).userId).toBe(accounts[0].id);
		expect(signinOf(service, second.token).userId).toBe(accounts[0].id);
	});

	it("reads the caller's own record for the address and its proof, not the request's user", async () => {
		const findOne = jest.spyOn(users, 'findOne');

		await service.openWorkspace();

		expect(findOne.mock.calls[0][0].where).toEqual({
			id: CALLER.id,
			tenantId: CALLER.tenantId,
			isActive: true,
			isArchived: false
		});
	});

	it('opens nothing for an address the caller has not proven: they would not even see the workspace', async () => {
		await users.update({ id: CALLER.id }, { emailVerifiedAt: null });

		await expect(service.openWorkspace()).rejects.toThrow(
			new ForbiddenException(WORKSPACE_ADDRESS_UNPROVEN_MESSAGE)
		);
		expect(await unfinishedAccounts()).toHaveLength(0);
	});

	it('opens nothing for a third-party application token', async () => {
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['read:timesheet']);

		await expect(service.openWorkspace()).rejects.toBeInstanceOf(ForbiddenException);
		expect(await unfinishedAccounts()).toHaveLength(0);
	});

	it('opens nothing without a signed-in user', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null as never);

		await expect(service.openWorkspace()).rejects.toBeInstanceOf(UnauthorizedException);
		expect(await unfinishedAccounts()).toHaveLength(0);
	});

	describe('where the sign-up has a paywall (a new workspace is a new tenant)', () => {
		const stripe = { isSignupPaywallEnabled: jest.fn(), getEntitlement: jest.fn() };

		beforeEach(() => {
			stripe.isSignupPaywallEnabled.mockReset().mockReturnValue(true);
			stripe.getEntitlement.mockReset();
			Object.assign(service, { stripeSubscriptionService: stripe });
		});

		it("opens nothing for an address without the product, and answers the sign-up's checkout to buy it", async () => {
			stripe.getEntitlement.mockResolvedValue(EntitlementResult.NOT_ENTITLED);

			const refusal = await service.openWorkspace().catch((error: ForbiddenException) => error);

			expect(refusal).toBeInstanceOf(ForbiddenException);
			expect((refusal as ForbiddenException).getResponse()).toEqual({
				statusCode: 403,
				message: WORKSPACE_SUBSCRIPTION_REQUIRED_MESSAGE,
				checkoutUrl: expect.stringContaining('email=ada%40ever.co')
			});
			expect(stripe.getEntitlement).toHaveBeenCalledWith(CALLER.email);
			expect(await unfinishedAccounts()).toHaveLength(0);
		});

		it('opens one for an address that holds the product', async () => {
			stripe.getEntitlement.mockResolvedValue(EntitlementResult.ENTITLED);

			await service.openWorkspace();

			expect(await unfinishedAccounts()).toHaveLength(1);
		});

		it('opens one when Stripe cannot answer, as the sign-up does', async () => {
			stripe.getEntitlement.mockResolvedValue(EntitlementResult.UNKNOWN);

			await service.openWorkspace();

			expect(await unfinishedAccounts()).toHaveLength(1);
		});

		it('asks Stripe nothing where there is no paywall (self-hosted, Ever Teams)', async () => {
			stripe.isSignupPaywallEnabled.mockReturnValue(false);

			await service.openWorkspace();

			expect(stripe.getEntitlement).not.toHaveBeenCalled();
			expect(await unfinishedAccounts()).toHaveLength(1);
		});
	});
});

describe("AuthService.openWorkspace, the address's lock on Postgres and MySQL", () => {
	afterEach(() => jest.restoreAllMocks());

	/** A service whose user table is the transaction's: the caller's record, no unfinished account yet. */
	function serviceOn(dataSource: Record<string, unknown>, manager: Record<string, unknown>) {
		const service: AuthService = Object.create(AuthService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmUserRepository: {
				target: 'User',
				findOne: jest.fn(async () => ({ ...CALLER, emailVerifiedAt: PROVEN })),
				manager: { dataSource }
			},
			logger: logger()
		});
		/** The user table, as the transaction reads and writes it. */
		const users = {
			findOne: jest.fn(async () => null),
			create: jest.fn((fields) => ({ ...fields })),
			save: jest.fn(async (entity) => ({ ...entity, id: 'new-account' })),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		Object.assign(manager, { getRepository: () => users });
		signedInAs({ id: CALLER.id, tenantId: CALLER.tenantId });
		return { service, users };
	}

	it('Postgres: the transaction takes an advisory lock named after a digest of the address, before reading', async () => {
		const manager: Record<string, unknown> = { query: jest.fn(async () => []) };
		const { service, users } = serviceOn(
			{ options: { type: 'postgres' }, transaction: jest.fn(async (work) => await work(manager)) },
			manager
		);

		await service.openWorkspace();

		const query = manager.query as jest.Mock;
		expect(query).toHaveBeenCalledTimes(1);
		const [sql, [name]] = query.mock.calls[0];
		expect(sql).toBe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))');
		expect(name).toMatch(/^workspace-opening:[0-9a-f]{32}$/);
		expect(name).not.toContain(CALLER.email);
		// Held before an unfinished account is looked up: an opening waiting for it then finds the one just created
		expect(query.mock.invocationCallOrder[0]).toBeLessThan(users.findOne.mock.invocationCallOrder[0]);
	});

	it("MySQL: a named lock on the transaction's own connection, taken before it starts and released after", async () => {
		const steps: string[] = [];
		const lockNames: string[] = [];
		const manager: Record<string, unknown> = {};
		const runner = {
			manager,
			connect: jest.fn(async () => steps.push('connect')),
			query: jest.fn(async (sql: string, [name]: string[]) => {
				steps.push(sql.startsWith('SELECT GET_LOCK') ? 'lock' : 'unlock');
				lockNames.push(name);
				return [{ acquired: 1 }];
			}),
			startTransaction: jest.fn(async () => steps.push('begin')),
			commitTransaction: jest.fn(async () => steps.push('commit')),
			rollbackTransaction: jest.fn(async () => steps.push('rollback')),
			release: jest.fn(async () => steps.push('release'))
		};
		const { service } = serviceOn({ options: { type: 'mysql' }, createQueryRunner: () => runner }, manager);

		await service.openWorkspace();

		expect(steps).toEqual(['connect', 'lock', 'begin', 'commit', 'unlock', 'release']);
		expect(lockNames[0]).toMatch(/^gauzy:workspace-opening:[0-9a-f]{32}$/);
		expect(lockNames[1]).toBe(lockNames[0]);
	});

	it('MySQL: refuses the opening when the lock stays held, without reading anything', async () => {
		const manager: Record<string, unknown> = {};
		const runner = {
			manager,
			connect: jest.fn(async () => undefined),
			query: jest.fn(async () => [{ acquired: 0 }]),
			startTransaction: jest.fn(),
			commitTransaction: jest.fn(),
			rollbackTransaction: jest.fn(),
			release: jest.fn(async () => undefined)
		};
		const { service } = serviceOn({ options: { type: 'mysql' }, createQueryRunner: () => runner }, manager);

		await expect(service.openWorkspace()).rejects.toBeInstanceOf(ConflictException);
		expect(runner.startTransaction).not.toHaveBeenCalled();
		expect(runner.release).toHaveBeenCalled();
	});
});

describe('POST /auth/workspaces', () => {
	it('is refused while the operator has closed tenant registration, before any account is opened', async () => {
		const authService = { openWorkspace: jest.fn() };
		const registrationPolicy = {
			assertTenantRegistrationOpen: jest.fn(async () => {
				throw new ForbiddenException('closed');
			})
		};
		const controller = new AuthController(authService as never, {} as never, registrationPolicy as never);

		await expect(controller.openWorkspace()).rejects.toBeInstanceOf(ForbiddenException);
		expect(authService.openWorkspace).not.toHaveBeenCalled();
	});

	it('answers the opening while tenant registration is open', async () => {
		const opening = { email: 'ada@ever.co', token: 'workspace-signin-token' };
		const authService = { openWorkspace: jest.fn(async () => opening) };
		const registrationPolicy = { assertTenantRegistrationOpen: jest.fn(async () => undefined) };
		const controller = new AuthController(authService as never, {} as never, registrationPolicy as never);

		await expect(controller.openWorkspace()).resolves.toBe(opening);
	});
});
