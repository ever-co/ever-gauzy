import { NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { assertCallerOwnsUpload } from './own-upload.helper';

const OWN_EMPLOYEE_ID = '5d2c1b0a-7e8f-4c3d-9a1b-0f2e3d4c5b04';
const OTHER_EMPLOYEE_ID = '9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c06';
const NOT_FOUND = 'Video with ID x not found.';

/**
 * Videos, camshots and soundshots store `uploadedById` rather than `employeeId`, and the automatic
 * per-employee restriction in `TenantAwareCrudService` is gated on the entity having an `employeeId`
 * column — so a by-id read of one of them was scoped to the tenant alone and answered for any
 * colleague's recording.
 */
describe('assertCallerOwnsUpload', () => {
	const actAs = (caller: { employeeId: string | null; canChangeSelectedEmployee?: boolean }) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(caller.employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) =>
				permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE && !!caller.canChangeSelectedEmployee
		);
	};

	afterEach(() => jest.restoreAllMocks());

	it('returns a record the caller uploaded', () => {
		actAs({ employeeId: OWN_EMPLOYEE_ID });
		const record = { uploadedById: OWN_EMPLOYEE_ID };

		expect(assertCallerOwnsUpload(record, NOT_FOUND)).toBe(record);
	});

	it('returns any record to a caller who may act for other employees', () => {
		actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: true });
		const record = { uploadedById: OTHER_EMPLOYEE_ID };

		expect(assertCallerOwnsUpload(record, NOT_FOUND)).toBe(record);
	});

	it.each([
		["another employee's record", OWN_EMPLOYEE_ID, OTHER_EMPLOYEE_ID],
		['a record with no uploader', OWN_EMPLOYEE_ID, undefined],
		['any record, for a caller with no employee identity', null, OTHER_EMPLOYEE_ID]
	])('hides %s behind the not-found answer', (_label, employeeId, uploadedById) => {
		actAs({ employeeId: employeeId as string | null });

		// 404 rather than 403: a 403 would confirm the id names a real record belonging to someone else
		expect(() => assertCallerOwnsUpload({ uploadedById } as any, NOT_FOUND)).toThrow(NotFoundException);
		expect(() => assertCallerOwnsUpload({ uploadedById } as any, NOT_FOUND)).toThrow(NOT_FOUND);
	});
});
