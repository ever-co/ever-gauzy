/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { IsNull, Not } from 'typeorm';
import { MultiORMEnum } from '../core/utils';
import { CrudService } from '../core/crud/crud.service';
import { TenantService } from './tenant.service';

/**
 * Onboarding finishes the tenant an earlier, failed attempt left behind instead of creating another, and two
 * onboardings of one user never run at once.
 *
 * On production (2026-10-27) every onboarding failed after `POST /tenant` had created the tenant and its
 * roles but before the creator was linked to it. The creator, still without a tenant, was sent back to
 * onboarding, and every retry created one more empty tenant (one user left five). These tests drive the
 * real TenantService methods with in-memory repositories.
 */

const USER_ID = '33333333-3333-4333-8333-333333333333';
const NEW_TENANT = '11111111-1111-4111-8111-111111111111';
const OLD_TENANT = '22222222-2222-4222-8222-222222222222';
const OLDER_TENANT = '44444444-4444-4444-8444-444444444444';
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';

/** Rows per tenant, by entity class name. */
type Rows = Record<string, string[]>;

function buildService({
	candidates = [] as Array<{ id: string; name: string }>,
	rows = {} as Rows,
	userTenantId = null as string | null
} = {}) {
	const service: any = Object.create(TenantService.prototype);
	const exists = jest.fn(async (entity: { name: string }, options: any) =>
		(rows[options.where.tenantId] ?? []).includes(entity.name)
	);
	service.typeOrmRepository = {
		manager: {
			getRepository: (entity: { name: string }) => ({ exists: (options: any) => exists(entity, options) })
		}
	};
	service.find = jest.fn(async () => candidates.map((candidate) => ({ ...candidate })));
	service.create = jest.fn(async (input: any) => ({ id: NEW_TENANT, ...input }));
	service.update = jest.fn(async () => ({ affected: 1 }));
	service.findOneByIdString = jest.fn(async () => undefined);
	service.commandBus = { execute: jest.fn(async () => []) };
	service.typeOrmRoleRepository = {
		findOneBy: jest.fn(async ({ tenantId, name }: any) => ({ id: `role-${tenantId}`, tenantId, name }))
	};
	service.typeOrmUserRepository = {
		exists: jest.fn(async () => !!userTenantId),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	service.linkStripeCustomerAtOnboarding = jest.fn(async () => null);
	service.configService = { get: () => ({ name: 'local' }) };
	return { service, exists };
}

const user = () => ({ id: USER_ID, email: 'founder@newco.test' }) as any;
const commands = (service: any) =>
	service.commandBus.execute.mock.calls.map(([command]: any) => command.constructor.name);
const command = (service: any, name: string) =>
	service.commandBus.execute.mock.calls.map(([c]: any) => c).find((c: any) => c.constructor.name === name);

/** A tenant whose roles, permissions and some default toggles were created before the attempt failed. */
const PARTLY_SEEDED = ['Role', 'RolePermission', 'FeatureOrganization'];

beforeEach(() => {
	jest.spyOn(console, 'time').mockImplementation(() => undefined);
	jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('TenantService.onboardTenant', () => {
	it('creates a tenant, seeds it and links the creator when they left nothing unfinished', async () => {
		const { service } = buildService();
		const update = jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		const tenant = await service.onboardTenant({ name: 'NewCo' }, user());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.create).toHaveBeenCalledWith({ name: 'NewCo', createdByUserId: USER_ID });
		expect(commands(service)).toEqual(['TenantRoleBulkCreateCommand']);
		expect(command(service, 'TenantRoleBulkCreateCommand').options).toEqual({ onlyMissing: false });
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: NEW_TENANT }), {
			onlyMissing: false,
			throwOnError: true
		});
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: NEW_TENANT },
			role: { id: `role-${NEW_TENANT}` }
		});
	});

	it('finishes the tenant a failed attempt left behind instead of creating another', async () => {
		const { service } = buildService({
			candidates: [{ id: OLD_TENANT, name: 'First try' }],
			rows: { [OLD_TENANT]: PARTLY_SEEDED }
		});
		const update = jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		const tenant = await service.onboardTenant({ name: 'Second try' }, user());

		expect(service.create).not.toHaveBeenCalled();
		expect(tenant).toEqual(expect.objectContaining({ id: OLD_TENANT, name: 'Second try' }));
		expect(service.update).toHaveBeenCalledWith(OLD_TENANT, { name: 'Second try' });
		// The role step completes what is there instead of creating every role and permission again.
		const roles = command(service, 'TenantRoleBulkCreateCommand');
		expect(roles.input).toEqual([expect.objectContaining({ id: OLD_TENANT })]);
		expect(roles.options).toEqual({ onlyMissing: true });
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: OLD_TENANT }), {
			onlyMissing: true,
			throwOnError: true
		});
		expect(service.typeOrmRoleRepository.findOneBy).toHaveBeenCalledWith({
			tenantId: OLD_TENANT,
			name: RolesEnum.SUPER_ADMIN
		});
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: OLD_TENANT },
			role: { id: `role-${OLD_TENANT}` }
		});
	});

	it.each([
		['an image', IMAGE_ID],
		['an explicit null, which clears the image', null]
	])('applies %s on resume through updateProfile', async (_case, imageId) => {
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'First try' }] });
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);
		const updateProfile = jest.spyOn(service, 'updateProfile').mockResolvedValue({ affected: 1 } as any);

		const tenant = await service.onboardTenant({ name: 'Second try', logo: 'logo.png', imageId }, user());

		expect(updateProfile).toHaveBeenCalledWith(OLD_TENANT, { name: 'Second try', logo: 'logo.png', imageId });
		expect(tenant).toEqual(expect.objectContaining({ id: OLD_TENANT, imageId }));
	});

	it('answers with the resumed tenant as stored, its new image included', async () => {
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'First try' }] });
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);
		jest.spyOn(service, 'updateProfile').mockResolvedValue({ affected: 1 } as any);
		const stored = { id: OLD_TENANT, name: 'Second try', imageId: IMAGE_ID, image: { id: IMAGE_ID } };
		service.findOneByIdString = jest.fn(async () => stored);

		const tenant = await service.onboardTenant({ name: 'Second try', imageId: IMAGE_ID }, user());

		expect(service.findOneByIdString).toHaveBeenCalledWith(OLD_TENANT);
		expect(tenant).toBe(stored);
	});

	it('refuses resuming with an image of another tenant, as any profile update does', async () => {
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'First try' }] });
		const update = jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);
		service.assertImageInTenant = jest.fn(async () => {
			throw new BadRequestException('The image does not belong to this tenant.');
		});

		await expect(service.onboardTenant({ name: 'Second try', imageId: IMAGE_ID }, user())).rejects.toThrow(
			BadRequestException
		);
		expect(service.assertImageInTenant).toHaveBeenCalledWith(IMAGE_ID, OLD_TENANT);
		expect(update).not.toHaveBeenCalled();
		expect(service.typeOrmUserRepository.update).not.toHaveBeenCalled();
	});

	it('refuses a second onboarding once the creator has a tenant, without creating another', async () => {
		// The route checked the user loaded with the request; a request that raced the first one passes that
		// check, so the service reads the user again.
		const { service } = buildService({ userTenantId: OLD_TENANT });

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow('Tenant already exists');

		expect(service.typeOrmUserRepository.exists).toHaveBeenCalledWith({
			where: { id: USER_ID, tenantId: Not(IsNull()) },
			withDeleted: true
		});
		expect(service.find).not.toHaveBeenCalled();
		expect(service.create).not.toHaveBeenCalled();
		expect(service.commandBus.execute).not.toHaveBeenCalled();
	});

	it('leaves the tenant unlinked when a seed fails, so the retry finishes it', async () => {
		const { service } = buildService();
		jest.spyOn(service, 'executeTenantUpdateTasks').mockRejectedValue(new Error('task_status insert failed'));

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow('task_status insert failed');

		expect(service.typeOrmUserRepository.update).not.toHaveBeenCalled();
		expect(service.linkStripeCustomerAtOnboarding).not.toHaveBeenCalled();
	});
});

describe('TenantService onboarding lock', () => {
	function postgresRunner(acquired: boolean) {
		const runner = {
			connect: jest.fn(async () => undefined),
			startTransaction: jest.fn(async () => undefined),
			rollbackTransaction: jest.fn(async () => undefined),
			release: jest.fn(async () => undefined),
			query: jest.fn(async (_sql?: string, _parameters?: unknown[]): Promise<any[]> => [{ acquired }])
		};
		return runner;
	}

	function withDataSource(service: any, type: string, runner: any, options: Record<string, unknown> = {}) {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const createQueryRunner = jest.fn(() => runner);
		service.typeOrmRepository.manager.dataSource = { options: { type, ...options }, createQueryRunner };
		return createQueryRunner;
	}

	it('lets only half the pool (at most 4) hold a lock connection; the others wait holding none', async () => {
		// A pool of 2 connections spares one for a lock. Without the bound, simultaneous signups could each hold
		// a lock connection while waiting for a connection to work with, and none could finish.
		const { service } = buildService();
		const createQueryRunner = withDataSource(service, 'postgres', postgresRunner(true), { poolSize: 2 });
		const finishers: Array<() => void> = [];
		jest.spyOn(service, 'executeTenantUpdateTasks').mockImplementation(
			() => new Promise<void>((resolve) => finishers.push(resolve))
		);
		const other = { id: '66666666-6666-4666-8666-666666666666', email: 'other@newco.test' } as any;

		const until = async (condition: () => boolean) => {
			for (let tick = 0; tick < 200 && !condition(); tick++)
				await new Promise((resolve) => setImmediate(resolve));
			expect(condition()).toBe(true);
		};

		const first = service.onboardTenant({ name: 'NewCo' }, user());
		const second = service.onboardTenant({ name: 'OtherCo' }, other);
		await until(() => finishers.length === 1);

		// The second onboarding waits for the slot without taking a connection.
		expect(createQueryRunner).toHaveBeenCalledTimes(1);

		finishers.shift()();
		await first;
		await until(() => finishers.length === 1);

		expect(createQueryRunner).toHaveBeenCalledTimes(2);
		finishers.shift()();
		await second;
	});

	it('reads a pool size of 0 as the driver default, and still takes the database lock', async () => {
		const { service } = buildService();
		const createQueryRunner = withDataSource(service, 'postgres', postgresRunner(true), { poolSize: 0 });
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		await service.onboardTenant({ name: 'NewCo' }, user());

		expect(createQueryRunner).toHaveBeenCalledTimes(1);
	});

	it('refuses a second onboarding of the same creator in this process at once, without waiting for a slot', async () => {
		const { service } = buildService();
		const createQueryRunner = withDataSource(service, 'postgres', postgresRunner(true), { poolSize: 2 });
		let finish: () => void = () => undefined;
		jest.spyOn(service, 'executeTenantUpdateTasks').mockImplementationOnce(
			() => new Promise<void>((resolve) => (finish = resolve))
		);

		const first = service.onboardTenant({ name: 'NewCo' }, user());
		for (let tick = 0; tick < 200 && createQueryRunner.mock.calls.length === 0; tick++) {
			await new Promise((resolve) => setImmediate(resolve));
		}

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow(ConflictException);
		expect(createQueryRunner).toHaveBeenCalledTimes(1);

		finish();
		await first;
	});

	it('keeps the onboarding result when MySQL cannot release the lock or its connection', async () => {
		const { service } = buildService();
		const runner = postgresRunner(true);
		runner.query = jest.fn(async (sql: string): Promise<any[]> => {
			if (sql.startsWith('SELECT RELEASE_LOCK')) throw new Error('connection lost');
			return [{ acquired: 1 }];
		});
		runner.release = jest.fn(async () => {
			throw new Error('already released');
		});
		withDataSource(service, 'mysql', runner);
		service.logger = { warn: jest.fn() };
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).resolves.toEqual(
			expect.objectContaining({ id: NEW_TENANT })
		);
		expect(service.logger.warn).toHaveBeenCalledTimes(2);
	});

	it('uses the in-process guard when the pool cannot spare a connection for the lock', async () => {
		const { service } = buildService();
		const createQueryRunner = withDataSource(service, 'postgres', postgresRunner(true), { poolSize: 1 });
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		await service.onboardTenant({ name: 'NewCo' }, user());

		expect(createQueryRunner).not.toHaveBeenCalled();
		expect(service.typeOrmUserRepository.update).toHaveBeenCalled();
	});

	it('takes a transaction-scoped advisory lock keyed by the creator on Postgres, and ends it afterwards', async () => {
		const { service } = buildService();
		const runner = postgresRunner(true);
		withDataSource(service, 'postgres', runner);
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		await service.onboardTenant({ name: 'NewCo' }, user());

		expect(runner.startTransaction).toHaveBeenCalled();
		// The idle lock transaction must outlive a server-side idle-in-transaction timeout.
		expect(runner.query).toHaveBeenNthCalledWith(1, 'SET LOCAL idle_in_transaction_session_timeout = 0');
		expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('pg_try_advisory_xact_lock'), [
			`tenant-onboarding:${USER_ID}`
		]);
		// The creator is linked while the lock is held.
		const linked = service.typeOrmUserRepository.update.mock.invocationCallOrder[0];
		expect(linked).toBeLessThan(runner.rollbackTransaction.mock.invocationCallOrder[0]);
		expect(runner.release).toHaveBeenCalled();
	});

	it('refuses with 409 when another onboarding of the same user holds the lock, touching nothing', async () => {
		const { service } = buildService();
		const runner = postgresRunner(false);
		withDataSource(service, 'postgres', runner);

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow(ConflictException);

		expect(service.find).not.toHaveBeenCalled();
		expect(service.create).not.toHaveBeenCalled();
		expect(runner.rollbackTransaction).toHaveBeenCalled();
		expect(runner.release).toHaveBeenCalled();
	});

	it('ends the lock when the onboarding fails', async () => {
		const { service } = buildService();
		const runner = postgresRunner(true);
		withDataSource(service, 'postgres', runner);
		jest.spyOn(service, 'executeTenantUpdateTasks').mockRejectedValue(new Error('seed failed'));

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow('seed failed');

		expect(runner.rollbackTransaction).toHaveBeenCalled();
		expect(runner.release).toHaveBeenCalled();
	});

	it.each([
		['takes and releases a named lock on MySQL', 1, undefined],
		['refuses with 409 on MySQL when the named lock is taken', 0, ConflictException]
	])('%s', async (_case, acquired, error) => {
		const { service } = buildService();
		const runner = postgresRunner(true);
		runner.query = jest.fn(async (sql: string): Promise<any[]> =>
			sql.startsWith('SELECT GET_LOCK') ? [{ acquired }] : []
		);
		withDataSource(service, 'mysql', runner);
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		const result = service.onboardTenant({ name: 'NewCo' }, user());

		if (error) {
			await expect(result).rejects.toThrow(error);
			expect(runner.query).not.toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', expect.anything());
		} else {
			await result;
			expect(runner.query).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', [`gauzy:tenant-onboarding:${USER_ID}`]);
		}
		expect(runner.query).toHaveBeenCalledWith('SELECT GET_LOCK(?, 0) AS `acquired`', [
			`gauzy:tenant-onboarding:${USER_ID}`
		]);
		expect(`gauzy:tenant-onboarding:${USER_ID}`.length).toBeLessThanOrEqual(64);
		expect(runner.startTransaction).not.toHaveBeenCalled();
		expect(runner.release).toHaveBeenCalled();
	});

	it('guards in process where the database offers no lock (SQLite, MikroORM)', async () => {
		const { service } = buildService();
		let finish: () => void = () => undefined;
		jest.spyOn(service, 'executeTenantUpdateTasks').mockImplementationOnce(
			() => new Promise<void>((resolve) => (finish = resolve))
		);

		const first = service.onboardTenant({ name: 'NewCo' }, user());
		await new Promise((resolve) => setImmediate(resolve));

		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow(ConflictException);
		expect(service.create).toHaveBeenCalledTimes(1);

		finish();
		await first;

		// Released: the next attempt runs (and is refused only because the creator now has a tenant).
		service.typeOrmUserRepository.exists = jest.fn(async () => true);
		await expect(service.onboardTenant({ name: 'NewCo' }, user())).rejects.toThrow('Tenant already exists');
	});
});

describe('TenantService.findUnfinishedTenant', () => {
	it('asks for every tenant the user created, newest first, without capping them before qualifying', async () => {
		const { service } = buildService();

		await service.findUnfinishedTenant(user());

		expect(service.find).toHaveBeenCalledWith({
			where: { createdByUserId: USER_ID },
			order: { createdAt: 'DESC' }
		});
	});

	it.each([
		['someone belongs to it', ['User', ...PARTLY_SEEDED]],
		['it has an organization', ['Organization', ...PARTLY_SEEDED]]
	])('leaves a tenant alone when %s', async (_reason, tenantRows) => {
		const { service } = buildService({
			candidates: [{ id: OLD_TENANT, name: 'Taken' }],
			rows: { [OLD_TENANT]: tenantRows }
		});

		await expect(service.findUnfinishedTenant(user())).resolves.toBeNull();
	});

	it('takes a tenant whose roles have no permissions: the role step completes them now', async () => {
		const { service } = buildService({
			candidates: [{ id: OLD_TENANT, name: 'Roles only' }],
			rows: { [OLD_TENANT]: ['Role'] }
		});

		await expect(service.findUnfinishedTenant(user())).resolves.toEqual(
			expect.objectContaining({ id: OLD_TENANT })
		);
	});

	it('takes the newest tenant that qualifies, however many newer ones do not', async () => {
		const taken = Array.from({ length: 6 }, (_, index) => ({
			id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${index}`,
			name: `Has a member ${index}`
		}));
		const { service } = buildService({
			candidates: [...taken, { id: OLDER_TENANT, name: 'Empty' }],
			rows: {
				...Object.fromEntries(taken.map(({ id }) => [id, ['User', ...PARTLY_SEEDED]])),
				[OLDER_TENANT]: PARTLY_SEEDED
			}
		});

		await expect(service.findUnfinishedTenant(user())).resolves.toEqual(
			expect.objectContaining({ id: OLDER_TENANT })
		);
	});

	it('counts soft-deleted rows, so a tenant someone was removed from is never taken over', async () => {
		const { service, exists } = buildService({ candidates: [{ id: OLD_TENANT, name: 'x' }] });

		await service.findUnfinishedTenant(user());

		expect(exists).toHaveBeenCalled();
		for (const [, options] of exists.mock.calls) {
			expect(options).toEqual({ where: { tenantId: OLD_TENANT }, withDeleted: true });
		}
	});

	it('resumes nothing under MikroORM, whose seeds are not written in one transaction', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'x' }] });

		await expect(service.findUnfinishedTenant(user())).resolves.toBeNull();
		expect(service.find).not.toHaveBeenCalled();
	});

	it('returns null without a user', async () => {
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'x' }] });

		await expect(service.findUnfinishedTenant(undefined as any)).resolves.toBeNull();
		expect(service.find).not.toHaveBeenCalled();
	});
});

describe('TenantService.executeTenantUpdateTasks', () => {
	const ALL = [
		'TenantFeatureOrganizationCreateCommand',
		'TenantStatusBulkCreateCommand',
		'TenantTaskSizeBulkCreateCommand',
		'TenantTaskPriorityBulkCreateCommand',
		'TenantIssueTypeBulkCreateCommand',
		'TenantSettingSaveCommand'
	];

	it('runs every task for a new tenant without looking for existing rows', async () => {
		const { service, exists } = buildService();

		await service.executeTenantUpdateTasks({ id: NEW_TENANT } as any);

		expect(commands(service)).toEqual(ALL);
		expect(command(service, 'TenantFeatureOrganizationCreateCommand').options).toEqual({ onlyMissing: false });
		expect(exists).not.toHaveBeenCalled();
	});

	it('runs only the tasks whose rows an unfinished tenant does not have, and completes its toggles', async () => {
		const { service } = buildService({ rows: { [OLD_TENANT]: ['TaskStatus', 'TaskSize', 'FeatureOrganization'] } });

		await service.executeTenantUpdateTasks({ id: OLD_TENANT } as any, { onlyMissing: true });

		expect(commands(service)).toEqual([
			'TenantFeatureOrganizationCreateCommand',
			'TenantTaskPriorityBulkCreateCommand',
			'TenantIssueTypeBulkCreateCommand',
			'TenantSettingSaveCommand'
		]);
		// Toggles are completed pair by pair: a migration gives every tenant some of them.
		expect(command(service, 'TenantFeatureOrganizationCreateCommand').options).toEqual({ onlyMissing: true });
	});

	it('throws the first failure only once every task has settled, when asked to', async () => {
		const { service } = buildService();
		let sizesDone = false;
		service.commandBus.execute = jest.fn(async (c: any) => {
			if (c.constructor.name === 'TenantStatusBulkCreateCommand') throw new Error('statuses failed');
			if (c.constructor.name === 'TenantTaskSizeBulkCreateCommand') {
				await new Promise((resolve) => setTimeout(resolve, 20));
				sizesDone = true;
			}
			return [];
		});

		await expect(
			service.executeTenantUpdateTasks({ id: NEW_TENANT } as any, { throwOnError: true })
		).rejects.toThrow('statuses failed');
		expect(sizesDone).toBe(true);
		// The settings step runs only after every seed succeeded.
		expect(commands(service)).not.toContain('TenantSettingSaveCommand');
	});

	it('logs a failure instead of throwing by default', async () => {
		const { service } = buildService();
		service.commandBus.execute = jest.fn(async () => {
			throw new Error('seed failed');
		});

		await expect(service.executeTenantUpdateTasks({ id: NEW_TENANT } as any)).resolves.toBeUndefined();
		expect(console.log).toHaveBeenCalled();
	});

	it('never leaves a rejected seed unhandled while a later check is still pending', async () => {
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandled);
		try {
			const { service, exists } = buildService();
			// The feature step fails at once, while the existence checks of the other steps are still pending.
			service.commandBus.execute = jest.fn(async (c: any) => {
				if (c.constructor.name === 'TenantFeatureOrganizationCreateCommand') throw new Error('features failed');
				return [];
			});
			exists.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(false), 20)));

			await expect(
				service.executeTenantUpdateTasks({ id: OLD_TENANT } as any, { onlyMissing: true, throwOnError: true })
			).rejects.toThrow('features failed');
			await new Promise((resolve) => setTimeout(resolve, 30));
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
		expect(unhandled).toEqual([]);
	});
});
