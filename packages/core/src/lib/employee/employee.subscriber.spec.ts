/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import * as membersCount from '../organization-project/organization-project-members-count';
import { Employee } from './employee.entity';
import { EmployeeSubscriber } from './employee.subscriber';

/**
 * #10680: the update hook used to start work whenever the entity carried a start date. The Employment
 * tab sends the stored start date back, and under MikroORM the entity is the whole stored row, so an
 * unrelated edit turned tracking and screen capture back on and reactivated ended employees. The hook
 * now only starts or ends work when the write changes `startedWorkOn` or `endWork`.
 */
describe('EmployeeSubscriber — work status on update', () => {
	const STARTED = new Date('2018-03-20T00:00:00.000Z');
	const ENDED = new Date('2024-06-30T00:00:00.000Z');

	let subscriber: EmployeeSubscriber;
	let setUserOrganizationStatus: jest.SpyInstance;

	beforeEach(() => {
		subscriber = new EmployeeSubscriber();
		setUserOrganizationStatus = jest.spyOn(subscriber, 'setUserOrganizationStatus').mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** A working employee whose admin switched time tracking and screen capture off. */
	function workingEmployee(): Employee {
		return Object.assign(new Employee(), {
			id: 'employee-1',
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			startedWorkOn: STARTED,
			endWork: null,
			position: 'Developer',
			isActive: true,
			isArchived: false,
			isTrackingEnabled: false,
			allowScreenshotCapture: false
		});
	}

	/** An employee whose work was ended (End Work). */
	function endedEmployee(): Employee {
		return Object.assign(workingEmployee(), {
			endWork: ENDED,
			isActive: false,
			isArchived: true
		});
	}

	it('leaves tracking and screen capture alone when the write sends the stored start date back', async () => {
		const employee = Object.assign(workingEmployee(), { position: 'Lead' });

		await subscriber.beforeEntityUpdate(employee, undefined, ['position']);

		expect(employee).toMatchObject({
			isTrackingEnabled: false,
			allowScreenshotCapture: false,
			isActive: true,
			isArchived: false
		});
		expect(setUserOrganizationStatus).not.toHaveBeenCalled();
	});

	it('keeps an ended employee ended on an unrelated edit', async () => {
		const employee = Object.assign(endedEmployee(), { position: 'Lead' });

		await subscriber.beforeEntityUpdate(employee, undefined, ['position']);

		expect(employee).toMatchObject({ endWork: ENDED, isActive: false, isArchived: true });
		expect(setUserOrganizationStatus).not.toHaveBeenCalled();
	});

	it('End Work keeps the end date and deactivates, although the stored start date is on the entity', async () => {
		const employee = Object.assign(workingEmployee(), { endWork: ENDED });

		await subscriber.beforeEntityUpdate(employee, undefined, ['endWork']);

		expect(employee).toMatchObject({
			endWork: ENDED,
			isActive: false,
			isArchived: true,
			isTrackingEnabled: false,
			allowScreenshotCapture: false
		});
		expect(setUserOrganizationStatus).toHaveBeenCalledWith(undefined, employee, false, true);
	});

	it('Start Work with a new date starts work', async () => {
		const employee = Object.assign(endedEmployee(), { startedWorkOn: new Date('2025-01-01T00:00:00.000Z') });

		await subscriber.beforeEntityUpdate(employee, undefined, ['startedWorkOn']);

		expect(employee).toMatchObject({
			endWork: null,
			isActive: true,
			isArchived: false,
			isTrackingEnabled: true,
			allowScreenshotCapture: true
		});
		expect(setUserOrganizationStatus).toHaveBeenCalledWith(undefined, employee, true, false);
	});

	it('Back to Work, which only clears the end date, reactivates the employee', async () => {
		const employee = Object.assign(endedEmployee(), { endWork: null });

		await subscriber.beforeEntityUpdate(employee, undefined, ['endWork']);

		expect(employee).toMatchObject({
			endWork: null,
			isActive: true,
			isArchived: false,
			isTrackingEnabled: true,
			allowScreenshotCapture: true
		});
		expect(setUserOrganizationStatus).toHaveBeenCalledWith(undefined, employee, true, false);
	});

	it('Back to Work under TypeORM, whose entity only holds the payload, reactivates the employee', async () => {
		const employee = Object.assign(new Employee(), { id: 'employee-1', endWork: null });

		await subscriber.beforeEntityUpdate(employee, undefined, ['endWork']);

		expect(employee).toMatchObject({ isActive: true, isArchived: false, isTrackingEnabled: true });
		expect(setUserOrganizationStatus).toHaveBeenCalledWith(undefined, employee, true, false);
	});

	it('an end date that was already empty does not reactivate anyone', async () => {
		const employee = Object.assign(new Employee(), { id: 'employee-1', endWork: null, isActive: false });

		await subscriber.beforeEntityUpdate(employee, undefined, ['position']);

		expect(employee.isActive).toBe(false);
		expect(setUserOrganizationStatus).not.toHaveBeenCalled();
	});

	describe('without changed properties (a query builder update)', () => {
		it('starts work when the update sets a start date, as before', async () => {
			const employee = Object.assign(new Employee(), { id: 'employee-1', startedWorkOn: STARTED });

			await subscriber.beforeEntityUpdate(employee, undefined, undefined);

			expect(employee).toMatchObject({ isActive: true, isArchived: false, isTrackingEnabled: true });
		});

		it('leaves the status alone when the update sets no work date', async () => {
			const employee = Object.assign(new Employee(), { id: 'employee-1', isTrackingEnabled: false });

			await subscriber.beforeEntityUpdate(employee, undefined, undefined);

			expect(employee.isTrackingEnabled).toBe(false);
			expect(employee.isActive).toBeUndefined();
			expect(setUserOrganizationStatus).not.toHaveBeenCalled();
		});
	});

	it('creating an employee with a start date still starts work', async () => {
		const employee = Object.assign(new Employee(), { startedWorkOn: STARTED });

		await subscriber.beforeEntityCreate(employee, undefined);

		expect(employee).toMatchObject({
			isActive: true,
			isArchived: false,
			isTrackingEnabled: true,
			allowScreenshotCapture: true
		});
	});
});

/**
 * End Work keeps the employee's project memberships (Back to Work restores them), but they no longer count in the
 * project's `membersCount`. A write that starts or ends their work recounts their projects once it is stored.
 */
describe('EmployeeSubscriber — project members count on a work status change', () => {
	let subscriber: EmployeeSubscriber;
	let recount: jest.SpyInstance;
	const em = {} as never;

	beforeEach(() => {
		subscriber = new EmployeeSubscriber();
		jest.spyOn(subscriber, 'setUserOrganizationStatus').mockResolvedValue(undefined);
		recount = jest.spyOn(membersCount, 'recountMembersOfEmployeeProjects').mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	const employee = (fields: Partial<Employee> = {}) =>
		Object.assign(new Employee(), {
			id: 'employee-1',
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			startedWorkOn: new Date('2018-03-20T00:00:00.000Z'),
			isActive: true,
			isArchived: false,
			...fields
		});

	it("recounts the employee's projects after End Work is stored", async () => {
		const ended = employee({ endWork: new Date('2026-10-01T00:00:00.000Z') });

		await subscriber.beforeEntityUpdate(ended, em, ['endWork']);
		expect(recount).not.toHaveBeenCalled();

		await subscriber.afterEntityUpdate(ended, em);
		expect(recount).toHaveBeenCalledTimes(1);
		expect(recount).toHaveBeenCalledWith(em, 'employee-1');
	});

	it("recounts the employee's projects after Back to Work is stored", async () => {
		const back = employee({ endWork: null, isActive: false, isArchived: true });

		await subscriber.beforeEntityUpdate(back, em, ['endWork']);
		await subscriber.afterEntityUpdate(back, em);

		expect(recount).toHaveBeenCalledWith(em, 'employee-1');
	});

	it('recounts after a write that changes `isActive` or `isArchived` directly, without a work date', async () => {
		// `PUT /employee/:id` takes both flags, which are what the members count reads
		const deactivated = employee({ isActive: false });

		await subscriber.beforeEntityUpdate(deactivated, em, ['isActive']);
		await subscriber.afterEntityUpdate(deactivated, em);

		const unarchived = employee({ isArchived: false });
		await subscriber.beforeEntityUpdate(unarchived, em, ['isArchived']);
		await subscriber.afterEntityUpdate(unarchived, em);

		expect(recount).toHaveBeenCalledTimes(2);
	});

	it('does not recount for a write that neither starts nor ends work, nor twice for one write', async () => {
		const edited = employee({ position: 'Lead' } as Partial<Employee>);

		await subscriber.beforeEntityUpdate(edited, em, ['position']);
		await subscriber.afterEntityUpdate(edited, em);
		expect(recount).not.toHaveBeenCalled();

		const ended = employee({ endWork: new Date('2026-10-01T00:00:00.000Z') });
		await subscriber.beforeEntityUpdate(ended, em, ['endWork']);
		await subscriber.afterEntityUpdate(ended, em);
		await subscriber.afterEntityUpdate(ended, em);
		expect(recount).toHaveBeenCalledTimes(1);
	});
});
