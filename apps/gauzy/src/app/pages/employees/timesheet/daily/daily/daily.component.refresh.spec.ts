import { BehaviorSubject } from 'rxjs';
import { DailyComponent } from './daily.component';

/**
 * After an add, edit or delete, the day's logs are read again. That read used to cover the whole list with a giant
 * spinner; the rows now stay usable until it answers. A new day or filter is still read under the loading state,
 * and so is a refresh that replaces such a read before it answered: the rows on screen are not its own (#12013).
 */
describe('DailyComponent refresh after a change', () => {
	const pending = () => new Promise(() => undefined);
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	const dailyPage = (getTimeLogs: jest.Mock) => {
		const component = Object.create(DailyComponent.prototype) as DailyComponent & Record<string, any>;
		component.organization = { id: 'org-1', name: 'Org' };
		component.loading = false;
		component['payloads$'] = new BehaviorSubject<any>({ organizationId: 'org-1', startDate: '2026-11-15' });
		component['refreshTrigger$'] = new BehaviorSubject<boolean>(false);
		component['_shownPayloadsKey'] = null;
		component['_timesheetService'] = { getTimeLogs };
		component['_errorHandlingService'] = { handleError: jest.fn() };
		component.selectTimeLog = jest.fn();
		component['_getDailyTimesheetLogs']();
		component.logs$.subscribe();
		return component;
	};

	it('reads a new day under the loading state', () => {
		const getTimeLogs = jest.fn(pending);
		const component = dailyPage(getTimeLogs);

		expect(getTimeLogs).toHaveBeenCalledTimes(1);
		expect(component.loading).toBe(true);
	});

	it('reads the logs again after a change without the loading state', async () => {
		const getTimeLogs = jest.fn(pending).mockResolvedValueOnce([]);
		const component = dailyPage(getTimeLogs);
		await settle();
		expect(component.loading).toBe(false);

		component['refreshTrigger$'].next(true);

		expect(getTimeLogs).toHaveBeenCalledTimes(2);
		expect(component.loading).toBe(false);
	});

	it('keeps the loading state when a refresh replaces the read of another day still on its way', async () => {
		const getTimeLogs = jest.fn(pending).mockResolvedValueOnce([]);
		const component = dailyPage(getTimeLogs);
		await settle();

		// Another day, whose read is still on its way when a change asks for a refresh
		component['payloads$'].next({ organizationId: 'org-1', startDate: '2026-11-16' });
		component['refreshTrigger$'].next(true);

		expect(getTimeLogs).toHaveBeenCalledTimes(3);
		expect(component.loading).toBe(true);
	});
});
