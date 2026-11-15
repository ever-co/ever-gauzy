import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, lastValueFrom, Subject } from 'rxjs';
import { GalleryService } from '@gauzy/ui-core/shared';
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

	const answeredWithSurvivor = () => {
		const component = pageWithTwoSlots();
		// The real store, holding what the two cards' `ngxGallery` appended when they were created
		const gallery = new GalleryService({} as HttpClient);
		gallery.appendItems([
			{ id: 'shot-a', thumbUrl: 'a-thumb', fullUrl: 'a-full' },
			{ id: 'shot-b', thumbUrl: 'b-thumb', fullUrl: 'b-full' }
		]);
		const removeGalleryItems = jest.spyOn(gallery, 'removeGalleryItems');
		component['_galleryService'] = gallery;
		component['_galleryItemIds'] = new Set(['shot-a', 'shot-b']);
		const survivor = {
			...slot('b', '2026-11-15T09:10:00Z'),
			screenshots: [{ id: 'shot-b', thumbUrl: 'b-thumb', fullUrl: 'b-full' }]
		};
		component['_timesheetService'] = { getTimeSlots: jest.fn(async () => [survivor]) };
		const storedIds = () => gallery.dataStore.map((item) => item.id);
		return { component, removeGalleryItems, storedIds };
	};

	it('keeps the screenshots of the cards still on screen in the gallery once the read after a deletion answers', async () => {
		const { component, removeGalleryItems, storedIds } = answeredWithSurvivor();

		await lastValueFrom(component['fetchTimeSlotsScreenshots'](true));

		// The kept card's `ngxGallery` does not append its screenshot again: only the deleted one leaves the store
		expect(removeGalleryItems).toHaveBeenCalledWith([{ id: 'shot-a' }]);
		expect(storedIds()).toEqual(['shot-b']);
		expect(shownSlotIds(component)).toEqual(['b']);
	});

	it('CONTROL: a new read drops every screenshot of the previous load, as its cards are built again', async () => {
		const { component, removeGalleryItems, storedIds } = answeredWithSurvivor();

		await lastValueFrom(component['fetchTimeSlotsScreenshots']());

		expect(removeGalleryItems).toHaveBeenCalledWith([{ id: 'shot-a' }, { id: 'shot-b' }]);
		expect(storedIds()).toEqual([]);
	});

	it('CONTROL: a new read (another day or filter) still empties the page under its loading state', () => {
		const component = pageWithTwoSlots();

		component['fetchTimeSlotsScreenshots']().subscribe();

		expect(component.loading).toBe(true);
		expect(component.timeSlots).toEqual([]);
	});
});
