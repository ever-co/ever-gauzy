import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, from, Observable, Subject } from 'rxjs';
import { catchError, debounceTime, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { chain, indexBy, pick, sortBy } from 'underscore';
import * as moment from 'moment-timezone';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot,
	PermissionsEnum,
	ID
} from '@gauzy/contracts';
import { isEmpty, distinctUntilChange, toTimezone } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, Store, TimesheetFilterService, TimesheetService } from '@gauzy/ui-core/core';
import {
	BaseSelectorFilterComponent,
	DeleteConfirmationComponent,
	GalleryService,
	GauzyFiltersComponent,
	TimeZoneService
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-screenshots',
	templateUrl: './screenshot.component.html',
	styleUrls: ['./screenshot.component.scss'],
	standalone: false
})
export class ScreenshotComponent extends BaseSelectorFilterComponent implements OnInit, OnDestroy {
	private readonly _router = inject(Router);
	private readonly _timesheetService = inject(TimesheetService);
	private readonly _timesheetFilterService = inject(TimesheetFilterService);
	private readonly _nbDialogService = inject(NbDialogService);
	private readonly _galleryService = inject(GalleryService);

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	screenshots$: Subject<boolean> = new Subject();
	filters: ITimeLogFilters = this.request;
	loading: boolean;
	timeSlots: IScreenshotMap[] = [];
	selectedIds: any = {};
	screenshotsUrls: { thumbUrl: string; fullUrl: string }[] = [];
	selectedIdsCount = 0;
	allSelected = false;
	originalTimeSlots: ITimeSlot[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		protected readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit(): void {
		// Filter changes → prepare request → fetch screenshots (single reactive chain)
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				debounceTime(100),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();

		// When payloads change, fetch new screenshots
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				switchMap(() => this.fetchTimeSlotsScreenshots()),
				untilDestroyed(this)
			)
			.subscribe();

		// Re-fetch screenshots on single slot deletion
		this.screenshots$
			.pipe(
				filter(() => !!this.organization && !isEmpty(this.request)),
				switchMap(() => this.fetchTimeSlotsScreenshots()),
				untilDestroyed(this)
			)
			.subscribe();

		// Clear gallery on navigation away
		this._router.events
			.pipe(
				filter((event) => event instanceof NavigationStart),
				tap(() => this._galleryService.clearGallery()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles changes in time log filters.
	 * If the saveFilters flag is enabled, saves the filters using the timesheetFilterService.
	 * Updates the component's filters and notifies subscribers about the filter change.
	 *
	 * @param filters The new set of filters for time logs.
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Check if the saveFilters flag is enabled
		if (this.gauzyFiltersComponent.saveFilters) {
			// Save filters using the timesheetFilterService if saveFilters is enabled
			this._timesheetFilterService.filter = filters;
		}

		// Update the component's filters by creating a shallow copy of the filters object
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Extract specific properties from filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		// Construct request object
		const request: IGetTimeSlotInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			relations: [
				// Include additional relations based on permissions
				...(this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ? ['employee.user'] : []),
				'screenshots',
				'timeLogs'
			]
		};
		this.payloads$.next(request);
	}

	/**
	 * Fetches time slot screenshots as an Observable.
	 * Designed for use with switchMap to cancel in-flight requests on new emissions.
	 */
	private fetchTimeSlotsScreenshots(): Observable<ITimeSlot[]> {
		this.loading = true;
		this.screenshotsUrls = [];
		this.timeSlots = [];
		this.originalTimeSlots = [];

		const payloads = this.payloads$.getValue();

		return from(this._timesheetService.getTimeSlots(payloads)).pipe(
			tap((timeSlots: ITimeSlot[]) => {
				this.originalTimeSlots = timeSlots;
				this.timeSlots = this.groupTimeSlots(timeSlots);
			}),
			catchError((error) => {
				console.error('Error while retrieving screenshots for employee', error);
				return EMPTY;
			}),
			finalize(() => {
				this.loading = false;
			})
		);
	}

	/**
	 * Toggles the selection state of a time slot identified by its ID.
	 * If a slotId is provided, toggles the selection state of the corresponding slot.
	 * Otherwise, updates all selections based on the current state of selectedIds.
	 *
	 * @param slotId The ID of the time slot to toggle selection for.
	 */
	toggleSelect(slotId?: ID): void {
		if (slotId) {
			// Toggle the selection state of the time slot identified by slotId
			this.selectedIds[slotId] = !this.selectedIds[slotId];
		}

		// Update selections based on the current state of selectedIds
		this.updateSelections();
	}

	/**
	 * Toggles the selection state of all time slots.
	 * Iterates through each time slot in selectedIds and toggles its selection state.
	 * After toggling all selections, updates the selections.
	 */
	toggleAllSelect(): void {
		for (const key in this.selectedIds) {
			if (this.selectedIds.hasOwnProperty(key)) {
				// Toggle the selection state of each time slot
				this.selectedIds[key] = !this.allSelected;
			}
		}

		// Update selections after toggling all time slots
		this.updateSelections();
	}

	/**
	 * Updates the selection state of time slots based on the selectedIds object.
	 * Counts the number of selected time slots and updates the allSelected flag accordingly.
	 */
	updateSelections(): void {
		// Count the number of selected time slots
		this.selectedIdsCount = Object.values(this.selectedIds).filter((val) => val === true).length;

		// Update the allSelected flag based on the number of selected time slots
		this.allSelected = this.selectedIdsCount === Object.values(this.selectedIds).length;
	}

	/**
	 * Initiates the deletion of a time slot.
	 * Notifies subscribers about the deletion request by emitting a value through the screenshots$ subject.
	 */
	deleteSlot(): void {
		// Notify subscribers about the deletion request
		this.screenshots$.next(true);
	}

	/**
	 * Initiates the deletion of multiple time slots.
	 * Opens a dialog for confirmation, then proceeds with the deletion if confirmed.
	 * After deletion, updates the screenshot gallery and notifies subscribers about the deletion.
	 */
	deleteSlots(): void {
		// Extract IDs of selected time slots before opening dialog
		const ids = Object.keys(this.selectedIds).filter((key) => this.selectedIds[key]);
		if (!ids.length) {
			return;
		}

		this._nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(
				filter((type) => type === 'ok'),
				switchMap(() => {
					const { id: organizationId, tenantId } = this.organization;
					return from(this._timesheetService.deleteTimeSlots({ ids, organizationId, tenantId }));
				}),
				tap(() => {
					this._deleteScreenshotGallery(ids);
					this.screenshots$.next(true);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Groups time slots by hour and prepares data for display.
	 * Also generates screenshot URLs and calculates employee work on the same time slots.
	 *
	 * @param slots An array of time slots to be grouped.
	 * @returns An array of grouped time slots for display.
	 */
	private groupTimeSlots(slots: ITimeSlot[]): IScreenshotMap[] {
		this.selectedIds = {};
		const timezone = this.filters?.timeZone;
		let screenshotUrls: { thumbUrl: string; fullUrl: string }[] = [];

		for (const slot of slots) {
			this.selectedIds[slot.id] = false;

			if (slot.screenshots?.length) {
				for (const screenshot of slot.screenshots) {
					screenshotUrls.push({ thumbUrl: screenshot.thumbUrl, fullUrl: screenshot.fullUrl });
				}
			}
		}
		this.screenshotsUrls = screenshotUrls;

		const convertTime = (slot: ITimeSlot) => (timezone ? toTimezone(slot.startedAt, timezone) : moment.utc(slot.startedAt).local());
		const getHour = (slot: ITimeSlot) => convertTime(slot).format('HH');
		const getMinute = (slot: ITimeSlot) => convertTime(slot).format('mm');

		const result = chain(slots)
			.groupBy(getHour)
			.mapObject((hourSlots: ITimeSlot[], hour): IScreenshotMap => {
				const groupByMinutes = chain(hourSlots).groupBy(getMinute).value();
				const byMinutes = indexBy(sortBy(hourSlots, 'screenshots'), getMinute);

				const slotsByMinute = ['00', '10', '20', '30', '40', '50'].map((key) => {
					if (!(key in byMinutes)) {
						return null;
					}

					byMinutes[key]['employees'] = chain(groupByMinutes[key])
						.groupBy((slot: ITimeSlot) => slot.employeeId)
						.values()
						.flatten()
						.map((slot: ITimeSlot) => slot.employee)
						.value();

					return byMinutes[key];
				});

				const time = moment().set('hour', Number.parseInt(hour, 10)).set('minute', 0);
				const startTime = time.format('HH:mm');
				const endTime = time.add(1, 'hour').format('HH:mm');

				return { startTime, endTime, timeSlots: slotsByMinute };
			})
			.values()
			.sortBy(({ startTime }) => moment(startTime, 'HH:mm').toDate().getTime())
			.value();

		this.updateSelections();
		return result;
	}

	/**
	 * Deletes screenshots associated with the specified time slots from the gallery.
	 *
	 * @param slotIds An array of time slot IDs whose screenshots should be removed from the gallery.
	 */
	private _deleteScreenshotGallery(slotIds: ID[]): void {
		if (isEmpty(slotIds) || isEmpty(this.originalTimeSlots)) {
			return;
		}

		const idsToRemove = new Set(slotIds);
		const screenshotsToRemove = this.originalTimeSlots
			.filter((slot: ITimeSlot) => idsToRemove.has(slot.id))
			.flatMap((slot: ITimeSlot) =>
				(slot.screenshots ?? []).map((screenshot: IScreenshot) => ({
					thumbUrl: screenshot.thumbUrl,
					fullUrl: screenshot.fullUrl,
					...screenshot
				}))
			);

		if (screenshotsToRemove.length) {
			this._galleryService.removeGalleryItems(screenshotsToRemove);
		}
	}

	ngOnDestroy(): void {
		this._galleryService.clearGallery();
	}
}
