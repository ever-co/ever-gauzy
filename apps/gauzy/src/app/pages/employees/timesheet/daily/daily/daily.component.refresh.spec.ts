import { BehaviorSubject } from 'rxjs';
import { DailyComponent } from './daily.component';

/**
 * After an add, edit or delete, the day's logs are read again. That read used to cover the whole list with a giant
 * spinner; the rows now stay usable until it answers. A new day or filter is still read under the loading state
 * (#12013).
 */
describe('DailyComponent refresh after a change', () => {
	const dailyPage = () => {
		const component = Object.create(DailyComponent.prototype) as DailyComponent & Record<string, any>;
		component.organization = { id: 'org-1', name: 'Org' };
		component.loading = false;
		component.payloads$ = new BehaviorSubject<any>({ organizationId: 'org-1', startDate: '2026-11-15' });
		component['refreshTrigger$'] = new BehaviorSubject<boolean>(false);
		component['_timesheetService'] = { getTimeLogs: jest.fn(() => new Promise(() => undefined)) };
		component['_errorHandlingService'] = { handleError: jest.fn() };
		component.selectTimeLog = jest.fn();
		component['_getDailyTimesheetLogs']();
		component.logs$.subscribe();
		return component;
	};

	it('reads a new day under the loading state', () => {
		const component = dailyPage();

		expect(component['_timesheetService'].getTimeLogs).toHaveBeenCalledTimes(1);
		expect(component.loading).toBe(true);
	});

	it('reads the logs again after a change without the loading state', () => {
		const component = dailyPage();
		component.loading = false;

		component['refreshTrigger$'].next(true);

		expect(component['_timesheetService'].getTimeLogs).toHaveBeenCalledTimes(2);
		expect(component.loading).toBe(false);
	});
});
