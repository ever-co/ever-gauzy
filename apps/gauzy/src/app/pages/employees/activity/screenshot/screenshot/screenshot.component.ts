import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot
} from '@gauzy/contracts';
import { debounceTime, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { toLocal, isEmpty } from '@gauzy/common-angular';
import { chain, indexBy, pick, sortBy } from 'underscore';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService, Store } from './../../../../../@core/services';
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
export class ScreenshotComponent extends BaseSelectorFilterComponent 
	implements OnInit, OnDestroy {

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
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbDialogService: NbDialogService,
		protected readonly store: Store,
		private readonly galleryService: GalleryService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.galleryService.clearGallery()),
				tap(() => this.getLogs()),
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

	async getLogs() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeSlotInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			relations: ['screenshots', 'timeLogs']
		};
		this.loading = true;
		try {
			this.screenshotsUrls = [];
			const timeSlots = await this.timesheetService.getTimeSlots(request);

			this.originalTimeSlots = timeSlots;
			this.timeSlots = this.groupTimeSlots(timeSlots);
		} catch (error) {
			console.log('Error while retrieving screenshots for employee', error);
		} finally {
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
		this.selectedIdsCount = Object.values(this.selectedIds).filter(
			(val) => val === true
		).length;
		this.allSelected =
			this.selectedIdsCount === Object.values(this.selectedIds).length;
	}

	deleteSlot() {
		this.subject$.next(true);
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
					}
					this.timesheetService.deleteTimeSlots(request).then(() => {
						this._deleteScreenshotGallery(ids);
						this.subject$.next(true);
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
			.mapObject(
				(hourTimeSlots: ITimeSlot[], hour): IScreenshotMap => {
					/**
					 * First sort by screenshots then after index by of hoursTimeSlots
					 * So, we can display screenshots in UI
					 */
					const byMinutes = indexBy(sortBy(hourTimeSlots, 'screenshots'), (timeSlot) =>
						moment(timeSlot.localStartedAt).format('mm')
					);
					timeSlots = ['00', '10', '20', '30', '40', '50'].map((key) => byMinutes[key] || null);
					
					const time = moment().set('hour', parseInt(hour, 0)).set('minute', 0);
					const startTime = time.format('HH:mm');
					const endTime = time.add(1, 'hour').format('HH:mm');
					
					return { startTime, endTime, timeSlots };
				}
			)
			.values()
			.sortBy(({ startTime }) =>
				moment(startTime, 'HH:mm').toDate().getTime()
			)
			.value();
		this.updateSelections();
		return groupTimeSlots;
	}

	private _deleteScreenshotGallery(timeSlotIds: string[]) {
		if (this.originalTimeSlots.length) {
			this.originalTimeSlots.forEach((timeSlot: ITimeSlot) => {
				if (timeSlotIds.includes(timeSlot.id)) {
					const galleryItems = timeSlot.screenshots.map(
						(screenshot: IScreenshot) => {
							return {
								thumbUrl: screenshot.thumbUrl,
								fullUrl: screenshot.fullUrl,
								...screenshot
							};
						}
					);
					this.galleryService.removeGalleryItems(galleryItems);
				}
			});
		}
	}
}
