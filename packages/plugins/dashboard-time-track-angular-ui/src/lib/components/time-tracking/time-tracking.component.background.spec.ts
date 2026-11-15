import { BehaviorSubject, NEVER, Subject } from 'rxjs';
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
		component.payloads$ = new BehaviorSubject<any>({ organizationId: 'org-1' });
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

	describe('the reads asked for within the debounce', () => {
		beforeEach(() => jest.useFakeTimers());
		afterEach(() => jest.useRealTimers());

		const listening = () => {
			const component = dashboard();
			component['_store'] = { user$: NEVER };
			component['_galleryService'] = { clearGallery: jest.fn() };
			component.payloads$ = new BehaviorSubject<any>(null);
			component.getStatistics = jest.fn(async () => undefined);
			component.ngOnInit();
			return component;
		};

		it.each([
			[true, 'background'],
			['background', true]
		])('a new scope wins over a background refresh met within the debounce (%p, then %p)', (first, second) => {
			const component = listening();

			component.logs$.next(first);
			component.logs$.next(second);
			jest.advanceTimersByTime(200);

			expect(component.getStatistics).toHaveBeenCalledTimes(1);
			expect(component.getStatistics).toHaveBeenCalledWith(false);
			expect(component['_galleryService'].clearGallery).toHaveBeenCalledTimes(1);
		});

		it('a background refresh alone reads in the background and keeps the gallery of the screenshots shown', () => {
			const component = listening();

			component.logs$.next('background');
			jest.advanceTimersByTime(200);

			expect(component.getStatistics).toHaveBeenCalledWith(true);
			expect(component['_galleryService'].clearGallery).not.toHaveBeenCalled();
		});

		it('a new scope read does not carry over to the next background refresh', () => {
			const component = listening();

			component.logs$.next(true);
			jest.advanceTimersByTime(200);
			component.logs$.next('background');
			jest.advanceTimersByTime(200);

			expect((component.getStatistics as jest.Mock).mock.calls).toEqual([[false], [true]]);
		});
	});
});
