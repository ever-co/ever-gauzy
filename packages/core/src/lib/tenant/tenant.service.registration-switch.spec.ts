/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { environment, IAuthSwitches } from '@gauzy/config';
import { MultiORMEnum } from '../core/utils';
import * as utils from '../core/utils';
import {
	RegistrationPolicyService,
	TENANT_REGISTRATION_DISABLED_MESSAGE
} from '../auth/auth-switches/registration-policy.service';
import { TenantService } from './tenant.service';

/**
 * #7821: with `ALLOW_TENANTS_REGISTRATION=false` nobody creates a new tenant (workspace) once the installation has
 * one, through REST (`POST /tenant`) or GraphQL (`createTenant`): both reach `TenantService.onboardTenant`. A new
 * installation still creates its first tenant, and a creator still finishes the tenant their own failed attempt left
 * behind (that adds no workspace). The real policy runs here, over an in-memory tenant table.
 */

const USER_ID = '66666666-6666-4666-8666-666666666666';
const NEW_TENANT = '77777777-7777-4777-8777-777777777777';
const UNFINISHED_TENANT = '88888888-8888-4888-8888-888888888888';

const switches = environment as unknown as { authSwitches: IAuthSwitches };
let previousSwitches: IAuthSwitches;

/**
 * A TenantService whose installation holds `tenants` tenants, and `unfinished` left behind by this creator. A tenant
 * it creates is added to the table, and stays unfinished (no user, no organization) until the creator is linked.
 */
function buildService({ tenants = 1, unfinished = false } = {}) {
	const table = { tenants, created: [] as any[] };
	const service: any = Object.create(TenantService.prototype);
	Object.defineProperty(service, 'ormType', { get: () => MultiORMEnum.TypeORM });
	// The creator's unfinished tenant has no user and no organization yet.
	service.typeOrmRepository = { manager: { getRepository: () => ({ exists: jest.fn(async () => false) }) } };
	service.find = jest.fn(async () =>
		unfinished ? [{ id: UNFINISHED_TENANT, name: 'First try' }] : [...table.created].reverse()
	);
	service.create = jest.fn(async (input: any) => {
		const tenant = { id: NEW_TENANT, ...input };
		table.tenants++;
		table.created.push(tenant);
		return tenant;
	});
	service.update = jest.fn(async () => ({ affected: 1 }));
	service.findOneByIdString = jest.fn(async () => undefined);
	service.commandBus = { execute: jest.fn(async () => []) };
	service.executeTenantUpdateTasks = jest.fn(async () => undefined);
	service.typeOrmRoleRepository = { findOneBy: jest.fn(async ({ tenantId }: any) => ({ id: `role-${tenantId}` })) };
	service.typeOrmUserRepository = {
		exists: jest.fn(async () => false),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	service.linkStripeCustomerAtOnboarding = jest.fn(async () => null);
	service.importRecords = jest.fn(async () => undefined);
	service.registrationPolicyService = new RegistrationPolicyService(
		{ exists: jest.fn(async () => table.tenants > 0) } as never,
		{ count: jest.fn(async () => table.tenants) } as never
	);
	return service;
}

const creator = () => ({ id: USER_ID, email: 'founder@newco.test' }) as any;
const rival = () => ({ id: '99999999-9999-4999-8999-999999999999', email: 'rival@newco.test' }) as any;

const OWN_LOCK = `tenant-onboarding:${USER_ID}`;
const FIRST_TENANT_LOCK = 'tenant-onboarding:first-tenant';

/** Gives the service a TypeORM data source of `type` whose lock connection grants the locks `acquired` allows. */
function withLockConnection(service: any, type: 'postgres' | 'mysql', acquired: (key: string) => boolean = () => true) {
	const runner = {
		connect: jest.fn(async () => undefined),
		startTransaction: jest.fn(async () => undefined),
		rollbackTransaction: jest.fn(async () => undefined),
		release: jest.fn(async () => undefined),
		query: jest.fn(async (sql: string, parameters?: unknown[]): Promise<any[]> => {
			if (sql.includes('pg_try_advisory_xact_lock')) return [{ acquired: acquired(String(parameters?.[0])) }];
			if (sql.startsWith('SELECT GET_LOCK')) {
				return [{ acquired: acquired(String(parameters?.[0]).replace(/^gauzy:/, '')) ? 1 : 0 }];
			}
			return [];
		})
	};
	const createQueryRunner = jest.fn(() => runner);
	service.typeOrmRepository.manager.dataSource = { options: { type }, createQueryRunner };
	const calls = (prefix: string) =>
		runner.query.mock.calls.filter(([sql]) => sql.includes(prefix)).map(([, parameters]) => parameters?.[0]);
	return { runner, createQueryRunner, calls };
}

/** Lets pending promises run until `condition` holds. */
async function until(condition: () => boolean) {
	for (let tick = 0; tick < 200 && !condition(); tick++) await new Promise((resolve) => setImmediate(resolve));
	expect(condition()).toBe(true);
}

beforeEach(() => {
	previousSwitches = switches.authSwitches;
	switches.authSwitches = { userRegistration: true, tenantsRegistration: true, adminPasswordReset: true };
	jest.spyOn(utils, 'getORMType').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(console, 'time').mockImplementation(() => undefined);
	jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
});

afterEach(() => {
	switches.authSwitches = previousSwitches;
	jest.restoreAllMocks();
});

describe('TenantService.onboardTenant — ALLOW_TENANTS_REGISTRATION', () => {
	it('creates a new tenant with the default switch (today’s behaviour)', async () => {
		const service = buildService({ tenants: 5 });

		const tenant = await service.onboardTenant({ name: 'NewCo' }, creator());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.create).toHaveBeenCalledTimes(1);
	});

	it('refuses a new tenant with a 403 once the installation has one', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 1 });

		await expect(service.onboardTenant({ name: 'NewCo' }, creator())).rejects.toThrow(
			new ForbiddenException(TENANT_REGISTRATION_DISABLED_MESSAGE)
		);
		expect(service.create).not.toHaveBeenCalled();
		expect(service.commandBus.execute).not.toHaveBeenCalled();
		expect(service.typeOrmUserRepository.update).not.toHaveBeenCalled();
	});

	it('lets a new installation create its first tenant', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 0 });

		const tenant = await service.onboardTenant({ name: 'First Co' }, creator());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: NEW_TENANT },
			role: { id: `role-${NEW_TENANT}` }
		});
	});

	it('lets the creator finish the tenant their own failed attempt left behind', async () => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
		const service = buildService({ tenants: 1, unfinished: true });

		const tenant = await service.onboardTenant({ name: 'Second try' }, creator());

		expect(service.create).not.toHaveBeenCalled();
		expect(tenant).toEqual(expect.objectContaining({ id: UNFINISHED_TENANT, name: 'Second try' }));
	});

	it('is not closed by APP_USER_REGISTRATION=false alone', async () => {
		switches.authSwitches = { ...switches.authSwitches, userRegistration: false };
		const service = buildService({ tenants: 1 });

		await expect(service.onboardTenant({ name: 'NewCo' }, creator())).resolves.toEqual(
			expect.objectContaining({ id: NEW_TENANT })
		);
	});
});

/**
 * The switch's check and the tenant's insert are separate steps. While the first-tenant exception is open, every
 * onboarding holds the creator's own lock AND one lock shared by every creator, so neither two people nor one person's
 * retry can create or seed a tenant alongside an onboarding that is still running.
 */
describe('TenantService.onboardTenant — onboarding locks under ALLOW_TENANTS_REGISTRATION=false', () => {
	beforeEach(() => {
		switches.authSwitches = { ...switches.authSwitches, tenantsRegistration: false };
	});

	it('lets only one of two simultaneous first onboardings by different people through', async () => {
		const service = buildService({ tenants: 0 });

		const results = await Promise.allSettled([
			service.onboardTenant({ name: 'First Co' }, creator()),
			service.onboardTenant({ name: 'Rival Co' }, rival())
		]);

		// Both found the table empty: the shared lock lets one create the first tenant and refuses the other.
		expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
		expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
		expect(service.create).toHaveBeenCalledTimes(1);
	});

	it('refuses the creator’s retry while their first onboarding is still running', async () => {
		const service = buildService({ tenants: 0 });
		let finish: () => void = () => undefined;
		service.executeTenantUpdateTasks = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));

		const first = service.onboardTenant({ name: 'First Co' }, creator());
		// The first tenant is inserted and being seeded: the exception is over, and that tenant looks unfinished.
		await until(() => service.executeTenantUpdateTasks.mock.calls.length === 1);

		// The retry would resume that tenant; the creator's own lock keeps it from running alongside the seeding.
		await expect(service.onboardTenant({ name: 'First Co' }, creator())).rejects.toThrow(ConflictException);
		expect(service.create).toHaveBeenCalledTimes(1);
		expect(service.executeTenantUpdateTasks).toHaveBeenCalledTimes(1);

		finish();
		await expect(first).resolves.toEqual(expect.objectContaining({ id: NEW_TENANT }));
	});

	it('takes the creator’s lock, then the shared one, on one Postgres connection', async () => {
		const service = buildService({ tenants: 0 });
		const { createQueryRunner, runner, calls } = withLockConnection(service, 'postgres');

		await service.onboardTenant({ name: 'First Co' }, creator());

		expect(calls('pg_try_advisory_xact_lock')).toEqual([OWN_LOCK, FIRST_TENANT_LOCK]);
		expect(createQueryRunner).toHaveBeenCalledTimes(1);
		// One transaction holds both; ending it releases both.
		expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
	});

	it('refuses with 409 while a first onboarding on another pod holds the shared lock', async () => {
		const service = buildService({ tenants: 0 });
		const { runner } = withLockConnection(service, 'postgres', (key) => key !== FIRST_TENANT_LOCK);

		await expect(service.onboardTenant({ name: 'Rival Co' }, rival())).rejects.toThrow(ConflictException);

		expect(service.create).not.toHaveBeenCalled();
		expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
	});

	it('takes only the creator’s own lock once a tenant exists', async () => {
		const service = buildService({ tenants: 1 });
		const { calls } = withLockConnection(service, 'postgres');

		await expect(service.onboardTenant({ name: 'NewCo' }, creator())).rejects.toThrow(ForbiddenException);

		expect(calls('pg_try_advisory_xact_lock')).toEqual([OWN_LOCK]);
	});

	it('releases MySQL named locks in reverse order', async () => {
		const service = buildService({ tenants: 0 });
		const { calls } = withLockConnection(service, 'mysql');

		await service.onboardTenant({ name: 'First Co' }, creator());

		expect(calls('GET_LOCK')).toEqual([`gauzy:${OWN_LOCK}`, `gauzy:${FIRST_TENANT_LOCK}`]);
		expect(calls('RELEASE_LOCK')).toEqual([`gauzy:${FIRST_TENANT_LOCK}`, `gauzy:${OWN_LOCK}`]);
	});

	it('gives back the creator’s MySQL lock when the shared one is taken', async () => {
		const service = buildService({ tenants: 0 });
		const { calls } = withLockConnection(service, 'mysql', (key) => key !== FIRST_TENANT_LOCK);

		await expect(service.onboardTenant({ name: 'Rival Co' }, creator())).rejects.toThrow(ConflictException);

		expect(calls('RELEASE_LOCK')).toEqual([`gauzy:${OWN_LOCK}`]);
		expect(service.create).not.toHaveBeenCalled();
	});
});

describe('TenantService.onboardTenant — onboarding locks with the default switch', () => {
	it('keeps onboardings of different people independent', async () => {
		const service = buildService({ tenants: 0 });

		const results = await Promise.allSettled([
			service.onboardTenant({ name: 'First Co' }, creator()),
			service.onboardTenant({ name: 'Rival Co' }, rival())
		]);

		expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
		expect(service.create).toHaveBeenCalledTimes(2);
	});

	it('takes only the creator’s own lock, as before', async () => {
		const service = buildService({ tenants: 0 });
		const { calls } = withLockConnection(service, 'postgres');

		await service.onboardTenant({ name: 'First Co' }, creator());

		expect(calls('pg_try_advisory_xact_lock')).toEqual([OWN_LOCK]);
	});
});
