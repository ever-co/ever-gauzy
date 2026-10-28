/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { RolesEnum } from '@gauzy/contracts';
import { TenantService } from './tenant.service';

/**
 * Onboarding finishes the tenant an earlier, failed attempt left behind instead of creating another.
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

/** Rows per tenant, by entity class name. */
type Rows = Record<string, string[]>;

function buildService({ candidates = [] as Array<{ id: string; name: string }>, rows = {} as Rows } = {}) {
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
	service.commandBus = { execute: jest.fn(async () => []) };
	service.typeOrmRoleRepository = {
		findOneBy: jest.fn(async ({ tenantId, name }: any) => ({ id: `role-${tenantId}`, tenantId, name }))
	};
	service.typeOrmUserRepository = { update: jest.fn(async () => ({ affected: 1 })) };
	service.linkStripeCustomerAtOnboarding = jest.fn(async () => null);
	service.configService = { get: () => ({ name: 'local' }) };
	return { service: service as TenantService & Record<string, any>, exists };
}

const user = () => ({ id: USER_ID, email: 'founder@newco.test' }) as any;
const commands = (service: any) =>
	service.commandBus.execute.mock.calls.map(([command]: any) => command.constructor.name);

/** A tenant whose roles and permissions were created before the attempt failed. */
const COMPLETE_ROLES = ['Role', 'RolePermission', 'FeatureOrganization'];

beforeEach(() => {
	jest.spyOn(console, 'time').mockImplementation(() => undefined);
	jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('TenantService.onboardTenant', () => {
	it('creates a tenant and links the creator when they left nothing unfinished', async () => {
		const { service } = buildService();
		const update = jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		const tenant = await service.onboardTenant({ name: 'NewCo' }, user());

		expect(tenant.id).toBe(NEW_TENANT);
		expect(service.create).toHaveBeenCalledWith({ name: 'NewCo' });
		expect(commands(service)).toEqual(['TenantRoleBulkCreateCommand']);
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: NEW_TENANT }), { onlyMissing: false });
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: NEW_TENANT },
			role: { id: `role-${NEW_TENANT}` }
		});
	});

	it('finishes the tenant a failed attempt left behind instead of creating another', async () => {
		const { service } = buildService({
			candidates: [{ id: OLD_TENANT, name: 'First try' }],
			rows: { [OLD_TENANT]: COMPLETE_ROLES }
		});
		const update = jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		const tenant = await service.onboardTenant({ name: 'Second try' }, user());

		expect(service.create).not.toHaveBeenCalled();
		expect(tenant).toEqual(expect.objectContaining({ id: OLD_TENANT, name: 'Second try' }));
		expect(service.update).toHaveBeenCalledWith(OLD_TENANT, { name: 'Second try' });
		// Its roles are already there: creating them again would duplicate every role and permission.
		expect(commands(service)).toEqual([]);
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: OLD_TENANT }), { onlyMissing: true });
		expect(service.typeOrmRoleRepository.findOneBy).toHaveBeenCalledWith({
			tenantId: OLD_TENANT,
			name: RolesEnum.SUPER_ADMIN
		});
		expect(service.typeOrmUserRepository.update).toHaveBeenCalledWith(USER_ID, {
			tenant: { id: OLD_TENANT },
			role: { id: `role-${OLD_TENANT}` }
		});
	});

	it('creates the roles of an unfinished tenant that has none', async () => {
		const { service } = buildService({ candidates: [{ id: OLD_TENANT, name: 'First try' }] });
		jest.spyOn(service, 'executeTenantUpdateTasks').mockResolvedValue(undefined);

		await service.onboardTenant({ name: 'Second try' }, user());

		expect(service.create).not.toHaveBeenCalled();
		expect(commands(service)).toEqual(['TenantRoleBulkCreateCommand']);
		const [[command]] = (service.commandBus.execute as jest.Mock).mock.calls;
		expect(command.input).toEqual([expect.objectContaining({ id: OLD_TENANT })]);
	});
});

describe('TenantService.findUnfinishedTenant', () => {
	it('asks only for tenants the user created, newest first', async () => {
		const { service } = buildService();

		await service.findUnfinishedTenant(user());

		expect(service.find).toHaveBeenCalledWith({
			where: { createdByUserId: USER_ID },
			order: { createdAt: 'DESC' },
			take: 5
		});
	});

	it.each([
		['someone belongs to it', ['User', ...COMPLETE_ROLES]],
		['it has an organization', ['Organization', ...COMPLETE_ROLES]],
		['its roles have no permissions, which re-running the role step cannot repair', ['Role']]
	])('leaves a tenant alone when %s', async (_reason, tenantRows) => {
		const { service } = buildService({
			candidates: [{ id: OLD_TENANT, name: 'Taken' }],
			rows: { [OLD_TENANT]: tenantRows }
		});

		await expect(service.findUnfinishedTenant(user())).resolves.toBeNull();
	});

	it('takes the newest tenant that qualifies', async () => {
		const { service } = buildService({
			candidates: [
				{ id: OLD_TENANT, name: 'Has a member' },
				{ id: OLDER_TENANT, name: 'Empty' }
			],
			rows: { [OLD_TENANT]: ['User', ...COMPLETE_ROLES], [OLDER_TENANT]: COMPLETE_ROLES }
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
		expect(exists).not.toHaveBeenCalled();
	});

	it('runs only the tasks whose rows an unfinished tenant does not have', async () => {
		// The failed attempt got as far as the feature toggles; the rest timed out.
		const { service } = buildService({ rows: { [OLD_TENANT]: COMPLETE_ROLES } });

		await service.executeTenantUpdateTasks({ id: OLD_TENANT } as any, { onlyMissing: true });

		expect(commands(service)).toEqual(ALL.filter((name) => name !== 'TenantFeatureOrganizationCreateCommand'));
	});

	it('runs nothing for a tenant that already has every row', async () => {
		const { service } = buildService({
			rows: {
				[OLD_TENANT]: [
					...COMPLETE_ROLES,
					'TaskStatus',
					'TaskSize',
					'TaskPriority',
					'IssueType',
					'TenantSetting'
				]
			}
		});

		await service.executeTenantUpdateTasks({ id: OLD_TENANT } as any, { onlyMissing: true });

		expect(commands(service)).toEqual([]);
	});
});
