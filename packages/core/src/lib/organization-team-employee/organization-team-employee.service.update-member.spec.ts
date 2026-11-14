// Must stay first: the service pulls the core entity graph in.
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TrackingTurnedOffEvent } from '../time-tracking/timer/events/tracking-turned-off.event';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * A member's running timer kept counting after their manager turned their tracking off for the team. The update that
 * turns it off now announces it for that team, and the timer module stops a timer running for it.
 */
describe('OrganizationTeamEmployeeService.updateMember', () => {
	const scope = { organizationId: 'organization-1', organizationTeamId: 'team-1' };
	const membership = { id: 'member-1', employeeId: 'employee-1', tenantId: 'tenant-1', ...scope };

	let service: OrganizationTeamEmployeeService;
	let publish: jest.Mock;
	let update: jest.Mock;
	let findMembership: jest.Mock;
	let stored: { isTrackingEnabled: boolean | null };

	beforeEach(() => {
		publish = jest.fn();
		stored = { isTrackingEnabled: true };
		update = jest.fn(async (_memberId: string, patch: { isTrackingEnabled?: boolean }) => {
			Object.assign(stored, patch);
			return { affected: 1 };
		});
		findMembership = jest.fn(async () => ({ ...membership, ...stored }));
		service = Object.create(OrganizationTeamEmployeeService.prototype);
		Object.assign(service, {
			_eventBus: { publish },
			update,
			findOneByWhereOptions: findMembership,
			withoutEmployeeFilter: (work: () => Promise<unknown>) => work(),
			typeOrmOrganizationTeamEmployeeRepository: {
				// The membership read with its roles before a switch changes: a plain member of the team
				findOne: jest.fn(async () => ({
					...membership,
					...stored,
					role: null,
					isManager: false,
					employee: { user: { role: { name: RolesEnum.EMPLOYEE } } }
				})),
				// The caller manages the team
				exists: jest.fn(async () => true)
			}
		});
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		// Their manager: an employee who manages the team, and may switch its members (ever-co/ever-teams#5015)
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'manager-user',
			employeeId: 'manager-employee',
			role: { name: RolesEnum.EMPLOYEE }
		} as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('saves the update, then announces tracking turned off for the team', async () => {
		const result = await service.updateMember('member-1', { ...scope, isTrackingEnabled: false });

		expect(result).toEqual({ affected: 1 });
		expect(update).toHaveBeenCalledWith('member-1', { ...scope, isTrackingEnabled: false });
		expect(findMembership).toHaveBeenCalledWith({ id: 'member-1', tenantId: 'tenant-1', ...scope });
		expect(publish).toHaveBeenCalledWith(
			new TrackingTurnedOffEvent({
				employeeId: 'employee-1',
				organizationId: 'organization-1',
				tenantId: 'tenant-1',
				organizationTeamId: 'team-1'
			})
		);
	});

	it('announces nothing when tracking was already off, or the update leaves it alone', async () => {
		await service.updateMember('member-1', { ...scope, order: 2 });
		stored.isTrackingEnabled = false;
		await service.updateMember('member-1', { ...scope, isTrackingEnabled: false });

		expect(publish).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('announces nothing when the update is refused', async () => {
		update.mockRejectedValue(new ForbiddenException());

		await expect(service.updateMember('member-1', { ...scope, isTrackingEnabled: false })).rejects.toThrow(
			ForbiddenException
		);
		expect(publish).not.toHaveBeenCalled();
	});
});
