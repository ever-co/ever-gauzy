// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { FindOperator } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { UpdateTimeSlotCommand } from '../update-time-slot.command';
import { UpdateTimeSlotHandler, UPDATABLE_TIME_SLOT_FIELDS } from './update-time-slot.handler';

/**
 * GHSA-6qvm-3wg4-26w4 — PUT /timesheet/time-slot/:id.
 *
 * The handler looked the slot up with `findOne({ where: { id } })` on a raw repository, wrote
 * `update(id, input)` with the whole body, and saved body activities with their own ids. Every tenant
 * owner is a SUPER_ADMIN (CHANGE_SELECTED_EMPLOYEE, exempt from OrganizationPermissionGuard), so a
 * foreign slot UUID was enough to modify it and read its time logs back.
 *
 * The repositories below are fakes that EVALUATE the where clause against fixtures (undefined keys are
 * dropped, as with the shipped `invalidWhereValuesBehavior.undefined: 'ignore'`), so a missing tenant
 * predicate shows up as a match on the foreign row. CONTROL arms run the pre-fix where shape.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const SLOTS = [
	{ id: 'slot-own', tenantId: TENANT_A, organizationId: 'org-a', employeeId: 'employee-a' },
	{ id: 'slot-foreign', tenantId: TENANT_B, organizationId: 'org-b', employeeId: 'employee-b' }
];

const ACTIVITIES = [
	{ id: 'activity-own', tenantId: TENANT_A, employeeId: 'employee-a' },
	{ id: 'activity-foreign', tenantId: TENANT_B, employeeId: 'employee-b' }
];

const matches = (row: Record<string, any>, where: Record<string, any>) =>
	Object.entries(where).every(([key, value]) => {
		if (value === undefined) {
			return true;
		}
		if (value instanceof FindOperator) {
			return (value.value as any[]).includes(row[key]);
		}
		return row[key] === value;
	});

function createHandler() {
	const timeSlotRepository = {
		findOne: jest.fn(async ({ where }: any) => SLOTS.find((slot) => matches(slot, where)) ?? null),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	const activityRepository = {
		find: jest.fn(async ({ where }: any) => ACTIVITIES.filter((activity) => matches(activity, where))),
		save: jest.fn(async (activities: any[]) => activities),
		metadata: { findRelationWithPropertyPath: (): undefined => undefined },
		manager: {}
	};
	const handler = new UpdateTimeSlotHandler(timeSlotRepository as any, activityRepository as any);
	return { handler, timeSlotRepository, activityRepository };
}

function asCaller(options: { tenantId?: string | null; employeeId?: string | null; canChangeEmployee?: boolean }) {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(
		(options.tenantId === undefined ? TENANT_A : options.tenantId) as any
	);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: options.employeeId ?? null } as any);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission) => !!options.canChangeEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
}

describe('UpdateTimeSlotHandler (GHSA-6qvm-3wg4-26w4)', () => {
	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: the pre-fix lookup of a super admin (no employee filter) finds the foreign slot', async () => {
		const { timeSlotRepository } = createHandler();
		const employeeId: string = undefined; // input.employeeId of a CHANGE_SELECTED_EMPLOYEE holder

		const found = await timeSlotRepository.findOne({
			where: { ...(employeeId ? { employeeId } : {}), id: 'slot-foreign' }
		});

		expect(found?.tenantId).toBe(TENANT_B);
	});

	it("does not find, update or return another tenant's slot for a super admin", async () => {
		const { handler, timeSlotRepository, activityRepository } = createHandler();
		asCaller({ canChangeEmployee: true });

		await expect(
			handler.execute(new UpdateTimeSlotCommand('slot-foreign', { overall: 0, activities: [{ title: 'x' } as any] }))
		).resolves.toBeNull();

		expect(timeSlotRepository.findOne).toHaveBeenCalledWith({ where: { tenantId: TENANT_A, id: 'slot-foreign' } });
		expect(timeSlotRepository.update).not.toHaveBeenCalled();
		expect(activityRepository.save).not.toHaveBeenCalled();
	});

	it('updates the own slot with the allowed fields only, scoped by tenant', async () => {
		const { handler, timeSlotRepository } = createHandler();
		asCaller({ employeeId: 'employee-a' });

		await handler.execute(
			new UpdateTimeSlotCommand('slot-own', {
				duration: 600,
				keyboard: 3,
				mouse: 4,
				overall: 5,
				tenantId: TENANT_B,
				organizationId: 'org-b',
				employeeId: 'employee-b',
				timeLogs: [{ id: 'log' } as any]
			} as any)
		);

		expect(timeSlotRepository.update).toHaveBeenCalledWith(
			{ id: 'slot-own', tenantId: TENANT_A },
			{ duration: 600, keyboard: 3, mouse: 4, overall: 5 }
		);
		expect(UPDATABLE_TIME_SLOT_FIELDS).not.toEqual(
			expect.arrayContaining(['tenantId', 'organizationId', 'employeeId', 'activities'])
		);
	});

	it('pins a caller without CHANGE_SELECTED_EMPLOYEE to their own employee, ignoring the body', async () => {
		const { handler, timeSlotRepository } = createHandler();
		asCaller({ employeeId: 'employee-a' });

		await handler.execute(new UpdateTimeSlotCommand('slot-own', { employeeId: 'employee-b', overall: 1 } as any));

		expect(timeSlotRepository.findOne).toHaveBeenCalledWith({
			where: { employeeId: 'employee-a', tenantId: TENANT_A, id: 'slot-own' }
		});
	});

	it('fails closed for a caller with neither CHANGE_SELECTED_EMPLOYEE nor an employee record', async () => {
		const { handler, timeSlotRepository } = createHandler();
		asCaller({ employeeId: null });

		await expect(handler.execute(new UpdateTimeSlotCommand('slot-own', { overall: 1 }))).resolves.toBeNull();
		expect(timeSlotRepository.findOne).not.toHaveBeenCalled();
	});

	it('fails closed without a tenant', async () => {
		const { handler, timeSlotRepository } = createHandler();
		asCaller({ tenantId: null, canChangeEmployee: true });

		await expect(handler.execute(new UpdateTimeSlotCommand('slot-own', { overall: 1 }))).resolves.toBeNull();
		expect(timeSlotRepository.findOne).not.toHaveBeenCalled();
	});

	it("saves body activities on the slot's own scope, and never under a foreign activity id", async () => {
		const { handler, timeSlotRepository, activityRepository } = createHandler();
		asCaller({ employeeId: 'employee-a' });

		await handler.execute(
			new UpdateTimeSlotCommand('slot-own', {
				activities: [
					{ id: 'activity-foreign', title: 'steal', tenantId: TENANT_B, employee: { id: 'employee-b' } },
					{ id: 'activity-own', title: 'resend' },
					{ title: 'new', organizationId: 'org-b', timeSlotId: 'slot-foreign' }
				] as any[]
			})
		);

		const saved = activityRepository.save.mock.calls[0][0];
		expect(saved.map((activity: any) => activity.id)).toEqual([undefined, 'activity-own', undefined]);
		for (const activity of saved) {
			expect(activity).toMatchObject({
				tenantId: TENANT_A,
				organizationId: 'org-a',
				employeeId: 'employee-a',
				timeSlotId: 'slot-own'
			});
			expect(activity.employee).toBeUndefined();
		}
		// The relation array never reaches update() (TypeORM cannot update a one-to-many that way).
		expect(timeSlotRepository.update).not.toHaveBeenCalled();
	});
});
