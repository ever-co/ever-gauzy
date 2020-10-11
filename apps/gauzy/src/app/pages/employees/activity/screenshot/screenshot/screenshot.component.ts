import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	ITimeLogFilters,
	IOrganization,
	ITimeSlot,
	IGetTimeSlotInput,
	IScreenshotMap
} from '@gauzy/models';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { debounceTime } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { toUTC, toLocal } from '@gauzy/utils';
import * as _ from 'underscore';
import * as moment from 'moment';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TimesheetFilterService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet-filter.service';

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

	constructor(
		private timesheetService: TimesheetService,
		private timesheetFilterService: TimesheetFilterService,
		private nbDialogService: NbDialogService,
		private store: Store
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
				this.updateLogs$.next();
			});

		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});
	}

	async filtersChange($event: ITimeLogFilters) {
		this.request = $event;
		this.timesheetFilterService.filter = $event;
		this.updateLogs$.next();
	}

	async getLogs() {
		if (!this.organization) {
			return;
		}

		const { employeeIds, startDate, endDate } = this.request;

		const request: IGetTimeSlotInput = {
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId,
			...this.request,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			...(employeeIds ? { employeeIds } : {}),
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

	toggleAllSelecte() {
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
						this.updateLogs$.next();
					});
				}
			});
	}

	ngOnDestroy(): void {}

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
					const time = moment().set('hour', hour).set('minute', 0);
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
}
