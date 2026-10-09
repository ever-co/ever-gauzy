import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { withoutTrackedDataRelations } from './tracked-data-sensitive-relations.config';

/**
 * `GET /timesheet/timer/status/worked?employeeId=<teammate>` is allowed to name someone else — the
 * last-worked log is a team-presence feature, and ORG_MEMBER_LAST_LOG_VIEW is a default EMPLOYEE
 * permission. The last log is the feature; the time slots, screenshots and activities hanging off it
 * are not, and since the root row belongs to the teammate the per-employee restriction never applies
 * to those rows. Narrowing keeps existing clients working: the answer loses the tracked-data rows
 * rather than the request being refused.
 */
describe('withoutTrackedDataRelations', () => {
	const grant = (permissions: PermissionsEnum[]) =>
		jest
			.spyOn(RequestContext, 'hasPermission')
			.mockImplementation((permission) => permissions.includes(permission));

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['timeSlots', ['task', 'timeSlots']],
		['nested screenshots', ['project', 'timeSlots.screenshots']],
		['activities', ['activities']],
		['timesheets', ['employee', 'timesheets']]
	])('drops %s for a caller who may not act for other employees', (_label, relations) => {
		grant([]);

		expect(withoutTrackedDataRelations(relations)).not.toContain(relations[relations.length - 1]);
	});

	it('keeps the relations that describe the log itself', () => {
		grant([]);

		expect(withoutTrackedDataRelations(['task', 'project', 'organizationContact', 'employee.user'])).toEqual([
			'task',
			'project',
			'organizationContact',
			'employee.user'
		]);
	});

	it('leaves everything in place for a caller who may act for other employees', () => {
		grant([PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		expect(withoutTrackedDataRelations(['timeSlots.screenshots'])).toEqual(['timeSlots.screenshots']);
	});

	it.each([
		['undefined', undefined],
		['a string', 'task'],
		['an object', { task: true }]
	])('passes %s through, since the sensitive-relation walk runs before this', (_label, relations) => {
		grant([]);

		expect(withoutTrackedDataRelations(relations)).toEqual(relations);
	});
});
