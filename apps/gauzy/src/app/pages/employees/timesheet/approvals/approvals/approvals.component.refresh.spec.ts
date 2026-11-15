import { TimesheetStatus } from '@gauzy/contracts';
import { ApprovalsComponent } from './approvals.component';

/**
 * Approving or denying a timesheet read every timesheet again under the list's giant spinner. The read after a
 * change now keeps the rows usable; a new period or filter is still read under the loading state (#12014).
 */
describe('ApprovalsComponent refresh after a change', () => {
	const approvalsPage = () => {
		const component = Object.create(ApprovalsComponent.prototype) as ApprovalsComponent & Record<string, any>;
		component['_fetchId'] = 0;
		component.organization = { id: 'org-1' };
		component['store'] = { user: { tenantId: 'tenant-1' } };
		component.request = {};
		component.getFilterRequest = jest.fn(() => ({}));
		component.timesheets = [{ id: 'sheet-1', status: TimesheetStatus.PENDING }];
		component.loading = false;
		component.saving = false;
		component['toastrService'] = { success: jest.fn() };
		component['timesheetService'] = {
			updateStatus: jest.fn(async () => undefined),
			getTimeSheets: jest.fn(() => new Promise(() => undefined))
		};
		return component;
	};

	it('reads the timesheets again after an approval without the loading state', async () => {
		const component = approvalsPage();

		component.updateStatus('sheet-1', TimesheetStatus.APPROVED);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(component['timesheetService'].getTimeSheets).toHaveBeenCalledTimes(1);
		expect(component.loading).toBe(false);
		expect(component.timesheets).toEqual([{ id: 'sheet-1', status: TimesheetStatus.PENDING }]);
	});

	it('CONTROL: a new period or filter is read under the loading state', () => {
		const component = approvalsPage();

		void component.getTimeSheets();

		expect(component.loading).toBe(true);
	});
});
