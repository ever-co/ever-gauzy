import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { from } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Subject } from 'rxjs/internal/Subject';
import { chain, indexBy, pick, sortBy } from 'underscore';
import moment from 'moment-timezone';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService, TimesheetFilterService, TimesheetService } from '@gauzy/ui-core/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot,
	PermissionsEnum
} from '@gauzy/contracts';
import { isEmpty, distinctUntilChange, isNotEmpty, toTimezone, Store } from '@gauzy/ui-core/common';
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
	styleUrls: ['./screenshot.component.scss']
})
export class ScreenshotComponent extends BaseSelectorFilterComponent implements AfterViewInit, OnInit, OnDestroy {
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	screenshots$: Subject<boolean> = new Subject();
	filters: ITimeLogFilters = this.request;
	loading: boolean;
	timeSlots: IScreenshotMap[];
	checkAllCheckbox: any;
	selectedIds: any = {};
	screenshotsUrls: { thumbUrl: string; fullUrl: string }[] = [];
	selectedIdsCount = 0;
	allSelected = false;
	originalTimeSlots: ITimeSlot[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _timesheetService: TimesheetService,
		private readonly _timesheetFilterService: TimesheetFilterService,
		private readonly _nbDialogService: NbDialogService,
		private readonly _galleryService: GalleryService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit(): void {
		this.screenshots$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.getTimeSlotsScreenshots()),
				untilDestroyed(this)
			)
			.subscribe();
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.screenshots$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
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
	 * Retrieves daily time slot data and screenshots for the current organization.
	 */
	async getTimeSlotsScreenshots() {
		// Check if organization is available and request payload is not empty
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set loading state to true
		this.loading = true;

		try {
			// Clear existing screenshots URLs
			this.screenshotsUrls = [];
			this.timeSlots = [];
			this.originalTimeSlots = [];

			// Fetch time slots data using provided payloads
			const payloads = this.payloads$.getValue();
			const timeSlots = await this._timesheetService.getTimeSlots(payloads);

			// Store original time slots and group them
			this.originalTimeSlots = timeSlots;
			this.timeSlots = this.groupTimeSlots(timeSlots);
		} catch (error) {
			// Handle any errors that occur during data retrieval
			console.log('Error while retrieving screenshots for employee', error);
		} finally {
			// Set loading state back to false
			this.loading = false;
		}
	}

	/**
	 * Toggles the selection state of a time slot identified by its ID.
	 * If a slotId is provided, toggles the selection state of the corresponding slot.
	 * Otherwise, updates all selections based on the current state of selectedIds.
	 *
	 * @param slotId The ID of the time slot to toggle selection for.
	 */
	toggleSelect(slotId?: string): void {
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
		// Open a confirmation dialog for deleting time slots
		const dialog$ = this._nbDialogService.open(DeleteConfirmationComponent);
		dialog$.onClose
			.pipe(
				filter((type) => type === 'ok'),
				switchMap(() => {
					// Extract IDs of selected time slots
					const ids = Object.keys(this.selectedIds).filter((key) => this.selectedIds[key]);

					// Construct request object with organization ID
					const { id: organizationId } = this.organization;
					const request = { ids, organizationId };

					// Convert the promise to an observable and handle deletion
					return from(this._timesheetService.deleteTimeSlots(request)).pipe(
						tap(() => this._deleteScreenshotGallery(ids)),
						tap(() => this.screenshots$.next(true))
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {
		this._galleryService.clearGallery();
	}

	/**
	 * Groups time slots by hour and prepares data for display.
	 * Also generates screenshot URLs and calculates employee work on the same time slots.
	 *
	 * @param timeSlots An array of time slots to be grouped.
	 * @returns An array of grouped time slots for display.
	 */
	private groupTimeSlots(timeSlots: ITimeSlot[]) {
		this.selectedIds = {};
		if (this.checkAllCheckbox) {
			this.checkAllCheckbox.checked = false;
			this.checkAllCheckbox.indeterminate = false;
		}

		const groupTimeSlots = chain(timeSlots)
			.map((timeSlot) => {
				this.selectedIds[timeSlot.id] = false;

				// Concatenate screenshot URLs
				this.screenshotsUrls = this.screenshotsUrls.concat(
					timeSlot.screenshots.map((screenshot) => ({
						thumbUrl: screenshot.thumbUrl,
						fullUrl: screenshot.fullUrl
					}))
				);

				return timeSlot;
			})
			.groupBy((timeSlot) => toTimezone(timeSlot.startedAt, this.filters?.timeZone).format('HH'))
			.mapObject((hourTimeSlots: ITimeSlot[], hour): IScreenshotMap => {
				const groupByMinutes = chain(hourTimeSlots)
					.groupBy((timeSlot) => toTimezone(timeSlot.startedAt, this.filters?.timeZone).format('mm'))
					.value();
				/**
				 * First sort by screenshots then after index by of hoursTimeSlots
				 * So, we can display screenshots in UI
				 */
				const byMinutes = indexBy(sortBy(hourTimeSlots, 'screenshots'), (timeSlot) =>
					toTimezone(timeSlot.startedAt, this.filters?.timeZone).format('mm')
				);
				timeSlots = ['00', '10', '20', '30', '40', '50'].map((key) => {
					/**
					 * Calculate employees work on same time slots by minutes
					 */
					if (key in byMinutes) {
						byMinutes[key]['employees'] = chain(groupByMinutes[key])
							.groupBy((timeSlot: ITimeSlot) => timeSlot.employeeId)
							.values()
							.flatten()
							.map((timeSlot: ITimeSlot) => timeSlot.employee)
							.value();
					}

					return byMinutes[key] || null;
				});

				const time = moment().set('hour', parseInt(hour, 0)).set('minute', 0);
				const startTime = time.format('HH:mm');
				const endTime = time.add(1, 'hour').format('HH:mm');

				return { startTime, endTime, timeSlots };
			})
			.values()
			.sortBy(({ startTime }) => moment(startTime, 'HH:mm').toDate().getTime())
			.value();
		this.updateSelections();
		return groupTimeSlots;
	}

	/**
	 * Deletes screenshots associated with the specified time slots from the gallery.
	 *
	 * @param timeSlotIds An array of time slot IDs whose screenshots should be removed from the gallery.
	 */
	private _deleteScreenshotGallery(timeSlotIds: string[]) {
		if (isNotEmpty(this.originalTimeSlots)) {
			// Extract all screenshots from time slots that match the provided time slot IDs
			const screenshotsToRemove = this.originalTimeSlots
				.filter((timeSlot: ITimeSlot) => timeSlotIds.includes(timeSlot.id))
				.flatMap((timeSlot: ITimeSlot) =>
					timeSlot.screenshots.map((screenshot: IScreenshot) => ({
						thumbUrl: screenshot.thumbUrl,
						fullUrl: screenshot.fullUrl,
						...screenshot // Include other properties from the screenshot
					}))
				);

			// Remove the extracted gallery items from the gallery
			this._galleryService.removeGalleryItems(screenshotsToRemove);
		}
	}
}
