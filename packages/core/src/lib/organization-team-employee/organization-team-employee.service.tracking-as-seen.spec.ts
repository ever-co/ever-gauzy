// Must stay first: the service pulls the core entity graph in.
import '../core/entities/internal';

import { ConflictException } from '@nestjs/common';
import { IOrganizationTeamEmployeeUpdateInput, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TRACKING_SWITCH_CHANGED } from '../time-tracking/timer/tracking-switch-rule';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

/**
 * A team switch saved from a screen read before someone turned it could act on a state that is gone: a stale "off"
 * stopped a timer the member had started since (ever-co/ever-gauzy#11830). An update that says which switch its screen
 * showed is refused when the stored one differs, and writes nothing.
 */
describe('OrganizationTeamEmployeeService.updateMember — the tracking switch the screen showed', () => {
	const scope = { organizationId: 'organization-1', organizationTeamId: 'team-1' };
	const membership = { id: 'member-1', employeeId: 'employee-1', tenantId: 'tenant-1', ...scope };

	let service: OrganizationTeamEmployeeService;
	let publish: jest.Mock;
	let update: jest.Mock;
	let stored: { isTrackingEnabled: boolean | null };

	const updateMember = (changes: IOrganizationTeamEmployeeUpdateInput) =>
		service.updateMember('member-1', { ...scope, ...changes });

	/** The refusal's code, or undefined when the update went through. */
	const refusalCodeOf = async (changes: IOrganizationTeamEmployeeUpdateInput): Promise<string | undefined> => {
		try {
			await updateMember(changes);
			return undefined;
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictException);
			return (error as ConflictException).getResponse()['code'];
		}
	};

	beforeEach(() => {
		publish = jest.fn();
		stored = { isTrackingEnabled: true };
		update = jest.fn(async (_memberId: string, patch: { isTrackingEnabled?: boolean }) => {
			Object.assign(stored, patch);
			return { affected: 1 };
		});
		const readMembership = jest.fn(async () => ({
			...membership,
			...stored,
			role: null,
			isManager: false,
			employee: { user: { role: { name: RolesEnum.EMPLOYEE } } }
		}));
		service = Object.create(OrganizationTeamEmployeeService.prototype);
		Object.assign(service, {
			_eventBus: { publish },
			update,
			findOneByWhereOptions: readMembership,
			withoutEmployeeFilter: (work: () => Promise<unknown>) => work(),
			typeOrmOrganizationTeamEmployeeRepository: {
				findOne: readMembership,
				exists: jest.fn(async () => true)
			}
		});
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'manager-user',
			employeeId: 'manager-employee',
			role: { name: RolesEnum.EMPLOYEE }
		} as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a switch whose screen showed another state, and writes and announces nothing', async () => {
		// The screen showed tracking off for the team, and someone turned it on since
		expect(await refusalCodeOf({ isTrackingEnabled: false, expectedIsTrackingEnabled: false })).toBe(
			TRACKING_SWITCH_CHANGED
		);
		expect(update).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it('reads a switch stored without a value as on, as the timer does', async () => {
		stored.isTrackingEnabled = null;

		expect(await refusalCodeOf({ isTrackingEnabled: true, expectedIsTrackingEnabled: false })).toBe(
			TRACKING_SWITCH_CHANGED
		);
		expect(await refusalCodeOf({ isTrackingEnabled: false, expectedIsTrackingEnabled: true })).toBeUndefined();
	});

	it('turns tracking off when the screen showed it on, and never writes the flag', async () => {
		await updateMember({ isTrackingEnabled: false, expectedIsTrackingEnabled: true });

		const written = update.mock.calls[0][1];
		expect(written.isTrackingEnabled).toBe(false);
		expect(written).not.toHaveProperty('expectedIsTrackingEnabled');
		expect(publish).toHaveBeenCalledTimes(1);
	});

	it('leaves an update that does not say what its screen showed as it was', async () => {
		await updateMember({ isTrackingEnabled: false });

		expect(update).toHaveBeenCalledWith('member-1', { ...scope, isTrackingEnabled: false });
		expect(publish).toHaveBeenCalledTimes(1);
	});
});
