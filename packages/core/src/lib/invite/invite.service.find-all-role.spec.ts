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

	async function roleFilterFor(role: unknown) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await service.findAllInvites({ where: { role } } as any);
		const [filter] = findAll.mock.calls[0];
		return filter.where[0].role;
	}

	it('reads the role name sent as where[role][name], as the Ever Teams apps send it', async () => {
		expect(await roleFilterFor({ name: 'EMPLOYEE' })).toEqual({ name: In(['EMPLOYEE']) });
	});

	it('reads the role names sent as where[role][name][0] and where[role][name][1]', async () => {
		expect(await roleFilterFor({ name: ['EMPLOYEE', 'MANAGER'] })).toEqual({ name: In(['EMPLOYEE', 'MANAGER']) });
	});

	it('keeps reading a role name sent as where[role]', async () => {
		expect(await roleFilterFor('MANAGER')).toEqual({ name: In(['MANAGER']) });
	});

	it('keeps reading the role names sent as where[role][0] and where[role][1]', async () => {
		expect(await roleFilterFor(['EMPLOYEE', 'MANAGER'])).toEqual({ name: In(['EMPLOYEE', 'MANAGER']) });
	});
});
