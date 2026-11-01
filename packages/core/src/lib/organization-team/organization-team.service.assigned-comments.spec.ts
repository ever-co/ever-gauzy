import '../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamService } from './organization-team.service';

/**
 * `PUT /organization-team/:id` writes the team from its body. The comments a team is assigned are written through the
 * comment API only, where the comment's record policy decides, so this write never links one.
 */
describe('OrganizationTeamService.update — the comments a team is assigned', () => {
	const TEAM = '72000000-0000-4000-8000-000000000001';
	const ORGANIZATION = '72000000-0000-4000-8000-0000000000a1';

	let create: jest.SpyInstance;
	let service: OrganizationTeamService;

	beforeEach(() => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ id: TEAM } as never);
		create = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: any) => entity);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		service = Object.create(OrganizationTeamService.prototype);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes the team without the comments the body assigns it, and every other field as before', async () => {
		const input = { organizationId: ORGANIZATION, name: 'Renamed', assignedComments: [{ id: 'note' }] } as any;

		await service.update(TEAM, input);

		expect(create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			name: 'Renamed',
			tenantId: 'tenant-1',
			id: TEAM
		});
		expect(input.assignedComments).toEqual([{ id: 'note' }]);
	});
});
