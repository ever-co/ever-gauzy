// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { debounceTime } from 'rxjs/operators';
import {
	IGetTimeLogInput,
	TimeLog,
	Timesheet,
	TimesheetStatus,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/models';
import * as _ from 'underscore';
import * as moment from 'moment';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';

@Component({
	selector: 'ngx-view',
	templateUrl: './view.component.html',
	styleUrls: ['./view.component.scss']
})
export class ViewComponent implements OnInit, OnDestroy {
	logRequest: {
		timesheetId?: string;
	} = {};

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	TimesheetStatus = TimesheetStatus;
	timeLogs: any;
	updateLogs$: Subject<any> = new Subject();
	timesheet: Timesheet;

	constructor(
		private timesheetService: TimesheetService,
		private activatedRoute: ActivatedRoute
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});

		this.activatedRoute.params
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params) {
					this.logRequest.timesheetId = params.id;
					this.updateLogs$.next();
				}
			});
	}

	async getLogs() {
		const request: IGetTimeLogInput = {
			timesheetId: this.logRequest.timesheetId
		};

		this.timesheetService
			.getTimeSheet(this.logRequest.timesheetId)
			.then((timesheet: Timesheet) => {
				this.timesheet = timesheet;
			});

		this.timesheetService.getTimeLogs(request).then((logs: TimeLog[]) => {
			this.timeLogs = _.chain(logs)
				.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
				.value();
		});
	}

	ngOnDestroy() {}
}
