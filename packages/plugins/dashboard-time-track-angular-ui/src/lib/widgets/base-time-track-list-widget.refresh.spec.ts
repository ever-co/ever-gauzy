import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, NEVER, Observable, of, Subject } from 'rxjs';
import {
	DASHBOARD_WIDGET_CONTEXT,
	IDashboardWidgetContext,
	TimesheetStatisticsCacheService
} from '@gauzy/ui-core/core';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';

/** One list widget, its endpoint answered by `answer`. */
class ProbeWidget extends BaseTimeTrackListWidgetComponent<{ id: string }> {
	protected readonly emptyMessageBaseKey = 'PROBE';
	public answer: () => Observable<{ id: string }[]> = () => of([{ id: 'row-1' }]);
	public get shownRows() {
		return this.rows();
	}
	protected fetch(): Observable<{ id: string }[]> {
		return this.answer();
	}
}

const scope = (startDate: string): IDashboardWidgetContext =>
	({
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		startDate,
		endDate: '2026-11-15T23:59:59.000Z',
		timeZone: 'UTC',
		employeeIds: [],
		projectIds: [],
		teamIds: []
	}) as unknown as IDashboardWidgetContext;

/**
 * A Time Tracking widget swapped its rows for the skeleton on every read, a refresh of the period on screen
 * included. A reload of the shown scope now keeps the rows; a new scope still shows the skeleton (#12022).
 */
describe('BaseTimeTrackListWidgetComponent reloads', () => {
	let context$: BehaviorSubject<IDashboardWidgetContext>;

	const loadedWidget = (firstAnswer?: () => Observable<{ id: string }[]>) => {
		context$ = new BehaviorSubject(scope('2026-11-09T00:00:00.000Z'));
		TestBed.configureTestingModule({
			providers: [
				{ provide: DASHBOARD_WIDGET_CONTEXT, useValue: context$ },
				{ provide: TimesheetStatisticsCacheService, useValue: { invalidate: jest.fn() } }
			]
		});
		const widget = TestBed.runInInjectionContext(() => new ProbeWidget());
		if (firstAnswer) widget.answer = firstAnswer;
		widget.ngOnInit();
		return widget;
	};

	it('shows the skeleton until its first rows come, then the rows', () => {
		const firstRows = new Subject<{ id: string }[]>();
		const widget = loadedWidget(() => firstRows);

		expect(widget.loading()).toBe(true);
		expect(widget.shownRows).toEqual([]);

		firstRows.next([{ id: 'row-1' }]);

		expect(widget.loading()).toBe(false);
		expect(widget.shownRows).toEqual([{ id: 'row-1' }]);
	});

	it('keeps its rows, without the skeleton, while the shown period is read again', () => {
		const widget = loadedWidget();
		widget.answer = () => NEVER;

		widget.refresh();

		expect(widget.loading()).toBe(false);
		expect(widget.shownRows).toEqual([{ id: 'row-1' }]);
	});

	it('CONTROL: shows the skeleton while another period is read', () => {
		const widget = loadedWidget();
		widget.answer = () => NEVER;

		context$.next(scope('2026-11-02T00:00:00.000Z'));

		expect(widget.loading()).toBe(true);
	});
});
