import { TimesheetStatus } from '@gauzy/contracts';
import { ApprovalsComponent } from './approvals.component';

/**
 * Approving or denying a timesheet read every timesheet again under the list's giant spinner. The read after a
 * change now keeps the rows usable, shows their new status once it answers, and keeps the rows checked meanwhile;
 * a new period or filter is still read under the loading state (#12014).
 */
describe('ApprovalsComponent refresh after a change', () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	const approvalsPage = () => {
		const component = Object.create(ApprovalsComponent.prototype) as ApprovalsComponent & Record<string, any>;
		component['_fetchId'] = 0;
		component.organization = { id: 'org-1' };
		component['store'] = { user: { tenantId: 'tenant-1' } };
		component.request = {};
		component.getFilterRequest = jest.fn(() => ({}));
		component.timesheets = [
			{ id: 'sheet-1', status: TimesheetStatus.PENDING },
			{ id: 'sheet-2', status: TimesheetStatus.PENDING }
		];
		component.statusFilter = null;
		component.statusOptions = [];
		component.allChecked = false;
		component.loading = false;
		component.saving = false;
		component['toastrService'] = { success: jest.fn() };
		let answer: (timesheets: unknown[]) => void;
		component['timesheetService'] = {
			updateStatus: jest.fn(async () => undefined),
			submitTimesheet: jest.fn(async () => undefined),
			getTimeSheets: jest.fn(() => new Promise((resolve) => (answer = resolve)))
		};
		return { component, answer: (timesheets: unknown[]) => answer(timesheets) };
	};

	it.each([
		['an approval', (component: ApprovalsComponent) => component.updateStatus('sheet-1', TimesheetStatus.APPROVED)],
		['a submission', (component: ApprovalsComponent) => component.submitTimesheet('sheet-1', 'submit')]
	])('after %s, reads the timesheets again without the loading state, then shows the answer', async (_, change) => {
		const { component, answer } = approvalsPage();

		change(component);
		await settle();

		expect(component['timesheetService'].getTimeSheets).toHaveBeenCalledTimes(1);
		expect(component.loading).toBe(false);
		expect(component.timesheets.map((timesheet) => timesheet.status)).toEqual([
			TimesheetStatus.PENDING,
			TimesheetStatus.PENDING
		]);

		answer([
			{ id: 'sheet-1', status: TimesheetStatus.APPROVED },
			{ id: 'sheet-2', status: TimesheetStatus.PENDING }
		]);
		await settle();

		expect(component.loading).toBe(false);
		expect(component.timesheets.map((timesheet) => timesheet.status)).toEqual([
			TimesheetStatus.APPROVED,
			TimesheetStatus.PENDING
		]);
		expect(component.statusOptions).toEqual([
			{ status: null, count: 2 },
			expect.objectContaining({ status: TimesheetStatus.PENDING, count: 1 }),
			expect.objectContaining({ status: TimesheetStatus.APPROVED, count: 1 })
		]);
	});

	it('keeps the rows checked while the read after a change was on its way', async () => {
		const { component, answer } = approvalsPage();
		component.checkedAll(true);

		component.updateStatus(['sheet-1', 'sheet-2'], TimesheetStatus.APPROVED);
		await settle();

		// The approved rows are done with; the next one is checked while the read is on its way
		expect(component.allChecked).toBe(false);
		expect(component.isCheckboxSelected()).toBe(false);
		component.toggleCheckbox(true, component.timesheets[1]);

		answer([
			{ id: 'sheet-1', status: TimesheetStatus.APPROVED },
			{ id: 'sheet-2', status: TimesheetStatus.PENDING }
		]);
		await settle();

		expect(component.timesheets.map((timesheet: any) => !!timesheet.checked)).toEqual([false, true]);
		expect(component.allChecked).toBe(false);
	});

	it('CONTROL: a new period or filter is read under the loading state', () => {
		const { component } = approvalsPage();

		void component.getTimeSheets();

		expect(component.loading).toBe(true);
	});
});
