import { Subject } from 'rxjs';
import { TimeTrackingComponent } from './time-tracking.component';

/**
 * The dashboard read every section again every 5 minutes, and after a deletion, under each card's giant spinner.
 * Those background reads of the same scope now keep the cards as they are; a new scope still shows the loading
 * states (#12022).
 */
describe('TimeTrackingComponent background reads', () => {
	const dashboard = () => {
		const component = Object.create(TimeTrackingComponent.prototype) as TimeTrackingComponent & Record<string, any>;
		component.organization = { id: 'org-1' };
		component.countsLoading = false;
		component.payloads$ = { getValue: () => ({ organizationId: 'org-1' }) };
		component.widgets = [{ hide: false }] as any;
		component['_widgetService'] = { widgets: [] };
		component['_windowService'] = { windows: [] };
		component['_timesheetStatisticsService'] = { getCounts: jest.fn(() => new Promise(() => undefined)) };
		component.logs$ = new Subject<any>();
		return component;
	};

	it('reads the counts in the background without their loading state', () => {
		const component = dashboard();

		void component.getCounts(true);

		expect(component['_timesheetStatisticsService'].getCounts).toHaveBeenCalledTimes(1);
		expect(component.countsLoading).toBe(false);
	});

	it('CONTROL: a new scope reads the counts under their loading state', () => {
		const component = dashboard();

		void component.getCounts();

		expect(component.countsLoading).toBe(true);
	});

	it('asks for a background read after a deletion', () => {
		const component = dashboard();
		const reads = jest.fn();
		component.logs$.subscribe(reads);

		component.onDelete();

		expect(reads).toHaveBeenCalledWith('background');
	});
});
