import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Subject } from 'rxjs/internal/Subject';
import { chain, indexBy, pick, sortBy } from 'underscore';
import moment from 'moment-timezone';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot,
	PermissionsEnum
} from '@gauzy/contracts';
import { toLocal, isEmpty, distinctUntilChange, isNotEmpty } from '@gauzy/ui-sdk/common';
import { Store } from './../../../../../@core/services';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { DeleteConfirmationComponent } from './../../../../../@shared/user/forms';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';
import { GalleryService } from './../../../../../@shared/gallery/gallery.service';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

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
		private readonly router: Router,
		public readonly translateService: TranslateService,
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbDialogService: NbDialogService,
		protected readonly store: Store,
		private readonly galleryService: GalleryService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
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
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationStart),
				tap(() => this.galleryService.clearGallery()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
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
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType', 'timeZone');

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

			// Fetch time slots data using provided payloads
			const payloads = this.payloads$.getValue();
			const timeSlots = await this.timesheetService.getTimeSlots(payloads);

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

	toggleSelect(slotId?: string) {
		if (slotId) {
			this.selectedIds[slotId] = !this.selectedIds[slotId];
		}
		this.updateSelections();
	}

	toggleAllSelect() {
		for (const key in this.selectedIds) {
			if (this.selectedIds.hasOwnProperty(key)) {
				this.selectedIds[key] = !this.allSelected;
			}
		}
		this.updateSelections();
	}

	updateSelections() {
		this.selectedIdsCount = Object.values(this.selectedIds).filter((val) => val === true).length;
		this.allSelected = this.selectedIdsCount === Object.values(this.selectedIds).length;
	}

	deleteSlot() {
		this.screenshots$.next(true);
	}

	deleteSlots() {
		this.nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe((type) => {
				if (type === 'ok') {
					const ids = chain(this.selectedIds)
						.pick((value, key) => value)
						.keys()
						.values()
						.value();
					const { id: organizationId } = this.organization;
					const request = {
						ids,
						organizationId
					};
					this.timesheetService.deleteTimeSlots(request).then(() => {
						this._deleteScreenshotGallery(ids);
						this.screenshots$.next(true);
					});
				}
			});
	}

	ngOnDestroy(): void {
		this.galleryService.clearGallery();
	}

	private groupTimeSlots(timeSlots: ITimeSlot[]) {
		this.selectedIds = {};
		if (this.checkAllCheckbox) {
			this.checkAllCheckbox.checked = false;
			this.checkAllCheckbox.indeterminate = false;
		}
		const groupTimeSlots = chain(timeSlots)
			.map((timeSlot) => {
				this.selectedIds[timeSlot.id] = false;
				timeSlot.localStartedAt = toLocal(timeSlot.startedAt).toDate();

				this.screenshotsUrls = this.screenshotsUrls.concat(
					timeSlot.screenshots.map((screenshot) => ({
						thumbUrl: screenshot.thumbUrl,
						fullUrl: screenshot.fullUrl
					}))
				);

				return timeSlot;
			})
			.groupBy((timeSlot) => moment(timeSlot.localStartedAt).format('HH'))
			.mapObject((hourTimeSlots: ITimeSlot[], hour): IScreenshotMap => {
				const groupByMinutes = chain(hourTimeSlots)
					.groupBy((timeSlot) => moment(timeSlot.localStartedAt).format('mm'))
					.value();
				/**
				 * First sort by screenshots then after index by of hoursTimeSlots
				 * So, we can display screenshots in UI
				 */
				const byMinutes = indexBy(sortBy(hourTimeSlots, 'screenshots'), (timeSlot) =>
					moment(timeSlot.localStartedAt).format('mm')
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
			this.galleryService.removeGalleryItems(screenshotsToRemove);
		}
	}
}
