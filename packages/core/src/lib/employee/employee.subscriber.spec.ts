/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

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
