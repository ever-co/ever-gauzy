// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IGetTimeLogInput,
	ITimeLog,
	ITimesheet,
	TimesheetStatus,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import * as _ from 'underscore';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TimesheetService } from './../../../../../@shared/timesheet/timesheet.service';
import { EditTimeLogModalComponent } from './../../../../../@shared/timesheet';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-timesheet-view',
	templateUrl: './view.component.html'
})
export class ViewComponent 
	extends TranslationBaseComponent 
	implements OnInit, OnDestroy {

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	TimesheetStatus = TimesheetStatus;
	timeLogs: any;
	logs$: Subject<any> = new Subject();
	timesheet: ITimesheet;
	timesheetId: string;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		private readonly nbDialogService: NbDialogService,
		public readonly translateService: TranslateService
	) {
		super(translateService)
	}

	ngOnInit() {
		this.logs$
			.pipe(
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.params
			.pipe(
				tap((params) => !!params),
				tap(({ id }) => this.timesheetId = id),
				tap(() => this.logs$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getLogs() {
		const request: IGetTimeLogInput = {
			timesheetId: this.timesheetId
		};

		this.timesheetService
			.getTimeSheet(this.timesheetId)
			.then((timesheet: ITimesheet) => {
				this.timesheet = timesheet;
			});

		this.timesheetService.getTimeLogs(request).then((logs: ITimeLog[]) => {
			this.timeLogs = _.chain(logs)
				.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
				.value();
		});
	}

	openEditDialog(timeLog) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: timeLog }
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe((resp) => {
				if (resp) {
					this.logs$.next();
				}
			});
	}

	deleteTimeLog(log) {
		this.timesheetService.deleteLogs([log.id])
			.then(() => {})
			.finally(() => {
				this.logs$.next();
			});
	}

	ngOnDestroy() {}
}
