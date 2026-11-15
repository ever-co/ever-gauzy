import { BehaviorSubject, Subject } from 'rxjs';
import { ScreenshotComponent } from './screenshot.component';

/**
 * Deleting a screenshot used to read every slot again after emptying the page: the hour grid unmounted under a
 * giant spinner and the page lost its scroll position. The deleted slot now leaves the grid at once, and the read
 * that follows keeps what is shown until it answers (#12010).
 */
describe('ScreenshotComponent deletion', () => {
	const slot = (id: string, startedAt: string) => ({
		id,
		startedAt,
		duration: 600,
		screenshots: [],
		employeeId: 'e1'
	});

	const pageWithTwoSlots = () => {
		const component = Object.create(ScreenshotComponent.prototype) as ScreenshotComponent & Record<string, any>;
		component['_slotIdsMap'] = new Map();
		component.selectedIds = {};
		component.loading = false;
		component.originalTimeSlots = [slot('a', '2026-11-15T09:00:00Z'), slot('b', '2026-11-15T09:10:00Z')] as any;
		component.timeSlots = component['groupTimeSlots'](component.originalTimeSlots);
		component['_deleteScreenshotGallery'] = jest.fn();
		component.screenshots$ = new Subject<boolean>();
		component.payloads$ = new BehaviorSubject<any>({ organizationId: 'org-1' });
		component['_timesheetService'] = { getTimeSlots: jest.fn(() => new Promise(() => undefined)) };
		component['_toastrService'] = { danger: jest.fn() };
		return component;
	};

	const shownSlotIds = (component: ScreenshotComponent) =>
		component.timeSlots.flatMap((hour) => hour.timeSlots.filter(Boolean).map((shown: any) => shown.id));

	it('takes the deleted slot off the grid at once and keeps the others', () => {
		const component = pageWithTwoSlots();
		const reads = jest.fn();
		component.screenshots$.subscribe(reads);

		component.deleteSlot(['a']);

		expect(shownSlotIds(component)).toEqual(['b']);
		expect(reads).toHaveBeenCalledWith(true);
	});

	it('keeps the grid and shows no page loading state while the read after a deletion is on its way', () => {
		const component = pageWithTwoSlots();

		component['fetchTimeSlotsScreenshots'](true).subscribe();

		expect(component.loading).toBe(false);
		expect(shownSlotIds(component)).toEqual(['a', 'b']);
	});

	it('CONTROL: a new read (another day or filter) still empties the page under its loading state', () => {
		const component = pageWithTwoSlots();

		component['fetchTimeSlotsScreenshots']().subscribe();

		expect(component.loading).toBe(true);
		expect(component.timeSlots).toEqual([]);
	});
});
