// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { OrganizationProjectEmployee, TimeLog } from '../../core/entities/internal';
import * as membership from '../../user-organization/assert-organization-membership';
import { assertMayReadClientRates, withKeptClientRates } from './time-log-client-rates';
import { clientRatesOfReportRow } from './time-log-pricing';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const MANAGER = '44444444-4444-4444-8444-444444444442';
const PORTAL = 'aaaaaaaa-5555-4555-8555-555555555551';
const OTHER = 'bbbbbbbb-5555-4555-8555-555555555552';

/** The project ids a membership read names (`In([...])`). */
type MembershipRead = { where?: { organizationProjectId?: { value?: string[] } } };

/**
 * An entity manager whose project membership read answers the projects the caller manages among those it names,
 * compared as written, as SQLite compares a varchar.
 */
function managerOf(managedProjectIds: string[]) {
	const find = jest.fn(async (entity: unknown, options?: MembershipRead) => {
		if (entity === OrganizationProjectEmployee) {
			const named = options?.where?.organizationProjectId?.value ?? [];
			return managedProjectIds
				.filter((organizationProjectId) => named.includes(organizationProjectId))
				.map((organizationProjectId) => ({ id: organizationProjectId, organizationProjectId }));
		}
		return [];
	});
	return { find } as any;
}

describe('who reads the client rates time logs keep', () => {
	let permissions: PermissionsEnum[];

	beforeEach(() => {
		permissions = [];
		jest.spyOn(membership, 'assertCurrentUserBelongsToOrganization').mockResolvedValue(undefined);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(MANAGER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE])(
		'lets an admin (%s) read them all, without naming a project',
		async (permission) => {
			permissions = [permission];
			const manager = managerOf([]);

			await expect(assertMayReadClientRates(manager, { organizationId: ORGANIZATION })).resolves.toBeUndefined();
			expect(manager.find).not.toHaveBeenCalled();
		}
	);

	it('lets a manager read the projects he manages, named in any case', async () => {
		const manager = managerOf([PORTAL]);

		await expect(
			assertMayReadClientRates(manager, { organizationId: ORGANIZATION, projectIds: [PORTAL.toUpperCase()] })
		).resolves.toBeUndefined();
	});

	it('refuses a manager who names a project he does not manage, or names none', async () => {
		const manager = managerOf([PORTAL]);

		await expect(
			assertMayReadClientRates(manager, { organizationId: ORGANIZATION, projectIds: [PORTAL, OTHER] })
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(assertMayReadClientRates(manager, { organizationId: ORGANIZATION })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('refuses a caller without an employee', async () => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);

		await expect(
			assertMayReadClientRates(managerOf([PORTAL]), { organizationId: ORGANIZATION, projectIds: [PORTAL] })
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses before anything else a caller who is not a member of the organization', async () => {
		permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
		jest.spyOn(membership, 'assertCurrentUserBelongsToOrganization').mockRejectedValue(
			new ForbiddenException('You are not a member of this organization')
		);

		await expect(assertMayReadClientRates(managerOf([]), { organizationId: ORGANIZATION })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});
});

describe('the client rates stated on each log', () => {
	it('states the client rates each log keeps, and all null for a log that keeps none', async () => {
		const find = jest.fn(async () => [
			{
				id: 'log-1',
				ratesStored: true,
				billRateValue: '50.00',
				projectBillRateValue: '90.00',
				projectMemberBillRateValue: null,
				projectBillRateCurrency: 'EUR',
				projectMemberBillRateCurrency: 'EUR'
			}
		]);
		const logs = [{ id: 'log-1' }, { id: 'log-2' }];

		const stated = await withKeptClientRates({ find } as any, logs, TENANT);

		expect(find).toHaveBeenCalledWith(TimeLog, expect.objectContaining({ withDeleted: true }));
		expect(stated).toEqual([
			{
				id: 'log-1',
				clientRates: {
					projectBillRateValue: 90,
					projectMemberBillRateValue: null,
					projectBillRateCurrency: 'EUR',
					projectMemberBillRateCurrency: 'EUR'
				}
			},
			{
				id: 'log-2',
				clientRates: {
					projectBillRateValue: null,
					projectMemberBillRateValue: null,
					projectBillRateCurrency: null,
					projectMemberBillRateCurrency: null
				}
			}
		]);
	});

	it('adds nothing to a report row of a report that did not ask, and both fields to one that did', () => {
		const clientRates = {
			projectBillRateValue: 90,
			projectMemberBillRateValue: null,
			projectBillRateCurrency: 'EUR',
			projectMemberBillRateCurrency: null
		};

		expect(clientRatesOfReportRow({ ratesStored: true })).toEqual({});
		expect(clientRatesOfReportRow({ ratesStored: 1 as never, clientRates })).toEqual({
			ratesStored: true,
			clientRates
		});
		expect(clientRatesOfReportRow({ ratesStored: null, clientRates })).toEqual({ ratesStored: false, clientRates });
	});
});
