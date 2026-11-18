import '../core/entities/internal';

import { In } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { InviteService } from './invite.service';

/**
 * The Ever Teams apps list a team's invitations with `where[role][name]=EMPLOYEE`. Since the role filter took arrays,
 * that object was read as a role name itself, and the list came back empty.
 */
describe('InviteService.findAllInvites role filter', () => {
	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: InviteService;

	beforeEach(() => {
		({ restore } = asTenantUser(createTenantFixture()));
		findAll = jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 });
		service = Object.create(InviteService.prototype);
		// The register reads the teams a caller without an organization-wide grant created; this one created none.
		Object.assign(service, { organizationTeamService: { find: jest.fn(async () => []) } });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	/** The conditions the register is read with: one per branch the caller's reach builds. */
	async function conditionsFor(where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await service.findAllInvites({ where } as any);
		const [filter] = findAll.mock.calls[0];
		return filter.where;
	}

	async function expectEveryBranchFiltersBy(role: unknown, names: string[]) {
		const conditions = await conditionsFor({ role });

		expect(conditions.length).toBeGreaterThan(0);
		for (const condition of conditions) {
			expect(condition.role).toEqual({ name: In(names) });
		}
	}

	it('reads the role name sent as where[role][name], as the Ever Teams apps send it', async () => {
		await expectEveryBranchFiltersBy({ name: 'EMPLOYEE' }, ['EMPLOYEE']);
	});

	it('reads the role names sent as where[role][name][0] and where[role][name][1]', async () => {
		await expectEveryBranchFiltersBy({ name: ['EMPLOYEE', 'MANAGER'] }, ['EMPLOYEE', 'MANAGER']);
	});

	it('keeps reading a role name sent as where[role]', async () => {
		await expectEveryBranchFiltersBy('MANAGER', ['MANAGER']);
	});

	it('keeps reading the role names sent as where[role][0] and where[role][1]', async () => {
		await expectEveryBranchFiltersBy(['EMPLOYEE', 'MANAGER'], ['EMPLOYEE', 'MANAGER']);
	});

	it('filters no role when none is sent', async () => {
		const conditions = await conditionsFor({});

		expect(conditions.length).toBeGreaterThan(0);
		for (const condition of conditions) {
			expect(condition).not.toHaveProperty('role');
		}
	});
});
