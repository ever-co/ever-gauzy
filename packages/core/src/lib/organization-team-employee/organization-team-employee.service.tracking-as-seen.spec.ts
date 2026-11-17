// Must stay first: the service pulls the core entity graph in.
import '../core/entities/internal';

import { ConflictException } from '@nestjs/common';
import { IOrganizationTeamEmployeeUpdateInput, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { TRACKING_SWITCH_CHANGED } from '../time-tracking/timer/tracking-switch-rule';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
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
	/** The switch the write's locked read finds: another admin may have saved one since the check. */
	let atWrite: { isTrackingEnabled: boolean | null } | null;
	let lockedRead: jest.Mock;

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
		atWrite = null;
		// The write's transaction: its locked read answers the switch as stored then (see tracking-switch-as-seen.ts)
		lockedRead = jest.fn(async () => ({ id: membership.id, ...(atWrite ?? stored) }));
		const transaction = { findOne: lockedRead, getRepository: jest.fn(() => ({})) };
		service = Object.create(OrganizationTeamEmployeeService.prototype);
		Object.defineProperty(service, 'ormType', { get: () => MultiORMEnum.TypeORM });
		Object.assign(service, {
			_eventBus: { publish },
			update,
			findOneByWhereOptions: readMembership,
			withoutEmployeeFilter: (work: () => Promise<unknown>) => work(),
			typeOrmOrganizationTeamEmployeeRepository: {
				target: OrganizationTeamEmployee,
				findOne: readMembership,
				exists: jest.fn(async () => true),
				manager: { transaction: jest.fn(async (work: (manager: unknown) => unknown) => work(transaction)) }
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
		expect(lockedRead).not.toHaveBeenCalled();
		expect(publish).toHaveBeenCalledTimes(1);
	});

	it('compares the switch again with the write, reading the membership in the scope the update names', async () => {
		await updateMember({ isTrackingEnabled: false, expectedIsTrackingEnabled: true });

		expect(lockedRead).toHaveBeenCalledTimes(1);
		expect(lockedRead.mock.calls[0][1].where).toEqual({ id: 'member-1', tenantId: 'tenant-1', ...scope });
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('refuses an update when another admin saved the switch after the check, and writes and announces nothing', async () => {
		// The screen and the check both read tracking on; another admin turned it off before the write
		atWrite = { isTrackingEnabled: false };

		expect(await refusalCodeOf({ isTrackingEnabled: true, expectedIsTrackingEnabled: true })).toBe(
			TRACKING_SWITCH_CHANGED
		);
		expect(update).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});
});
