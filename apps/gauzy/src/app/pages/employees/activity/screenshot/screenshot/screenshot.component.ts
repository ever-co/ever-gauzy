import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	ITimeLogFilters,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap,
	IScreenshot
} from '@gauzy/contracts';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from './../../../../../@core/services/store.service';
import { combineLatest, Subject } from 'rxjs';
import { toUTC, toLocal } from '@gauzy/common-angular';
import * as _ from 'underscore';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from './../../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';
import { GalleryService } from 'apps/gauzy/src/app/@shared/gallery/gallery.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-screenshot',
	templateUrl: './screenshot.component.html',
	styleUrls: ['./screenshot.component.scss']
})
export class ScreenshotComponent implements OnInit, OnDestroy {
	request: ITimeLogFilters;
	loading: boolean;
	timeSlots: IScreenshotMap[];
	checkAllCheckbox: any;
	selectedIds: any = {};
	updateLogs$: Subject<any> = new Subject();
	organization: any;
	screenshotsUrls: { thumbUrl: string; fullUrl: string }[] = [];
	selectedIdsCount = 0;
	allSelected = false;
	orignalTimeSlots: ITimeSlot[];
	selectedEmployeeId: string | null = null;
	projectId: string | null = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly nbDialogService: NbDialogService,
		private readonly store: Store,
		private readonly galleryService: GalleryService
	) {}

	ngOnInit(): void {
		const storeProject$ = this.store.selectedProject$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		combineLatest([storeProject$, storeEmployee$, storeOrganization$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([project, employee, organization]) => {
					if (organization) {
						this.organization = organization;
						this.selectedEmployeeId = employee ? employee.id : null;
						this.projectId = project ? project.id : null;
						this.updateLogs$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.updateLogs$
			.pipe(
				debounceTime(800),
				tap(() => this.galleryService.clearGallery()),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async filtersChange($event: ITimeLogFilters) {
		this.request = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization || !this.request) {
			return;
		}

		const { startDate, endDate } = this.request;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const employeeIds: string[] = [];
		if (this.selectedEmployeeId) {
			employeeIds.push(this.selectedEmployeeId);
		}

		const projectIds: string[] = [];
		if (this.projectId) {
			projectIds.push(this.projectId);
		}

		const request: IGetTimeSlotInput = {
			organizationId,
			tenantId,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			...(employeeIds.length > 0 ? { employeeIds } : {}),
			...(projectIds.length > 0 ? { projectIds } : {}),
			relations: ['screenshots', 'timeLogs']
		};

		this.loading = true;
		this.screenshotsUrls = [];
		this.timesheetService
			.getTimeSlots(request)
			.then((timeSlots) => {
				this.orignalTimeSlots = timeSlots;
				this.timeSlots = this.groupTimeSlots(timeSlots);
			})
			.finally(() => (this.loading = false));
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
		this.updateLogs$.next();
	}

	deleteSlots() {
		this.nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe((type) => {
				if (type === 'ok') {
					const ids = _.chain(this.selectedIds)
						.pick((value, key) => value)
						.keys()
						.values()
						.value();
					this.timesheetService.deleteTimeSlots(ids).then(() => {
						this._deleteScreenshotGallery(ids);
						this.updateLogs$.next();
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
		const groupTimeSlots = _.chain(timeSlots)
			.map((timeSlot) => {
				this.selectedIds[timeSlot.id] = false;
				timeSlot.localStartedAt = toLocal(timeSlot.startedAt).toDate();

				// timeSlot.localStoppedAt = toLocal(timeSlot.stoppedAt).toDate();
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
					const byMinutes = _.indexBy(hourTimeSlots, (timeSlot) =>
						moment(timeSlot.localStartedAt).format('mm')
					);
					timeSlots = ['00', '10', '20', '30', '40', '50'].map(
						(key) => byMinutes[key] || null
					);
					const time = moment()
						.set('hour', parseInt(hour, 0))
						.set('minute', 0);
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
		if (this.orignalTimeSlots.length) {
			this.orignalTimeSlots.forEach((timeSlot: ITimeSlot) => {
				if (timeSlotIds.includes(timeSlot.id)) {
					const gallaryItems = timeSlot.screenshots.map(
						(screenshot: IScreenshot) => {
							return {
								thumbUrl: screenshot.thumbUrl,
								fullUrl: screenshot.fullUrl,
								...screenshot
							};
						}
					);
					this.galleryService.removeGalleryItems(gallaryItems);
				}
			});
		}
	}
}
