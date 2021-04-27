import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import * as moment from 'moment';
import { toUTC } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { pick, pluck } from 'underscore';

@UntilDestroy()
@Component({
	selector: 'ga-amounts-owed-report',
	templateUrl: './amounts-owed-report.component.html',
	styleUrls: ['./amounts-owed-report.component.scss']
})
export class AmountsOwedReportComponent
	extends TranslationBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: IGetExpenseInput = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	updateLogs$: Subject<any> = new Subject();
	organization: IOrganization;

	loading: boolean;
	chartData: any;

	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	filters: IGetExpenseInput;

	selectedEmployeeId: string | null = null;
	projectId: string | null = null;

	private _selectedDate: Date = new Date();
	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private timesheetService: TimesheetService,
		private cd: ChangeDetectorRef,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.updateLogs$
			.pipe(
				debounceTime(1350),
				tap(() => this.updateChartData()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeEmployee$, storeProject$])
			.pipe(
				filter(([organization]) => !!organization),
				tap(([organization, employee, project]) => {
					if (organization) {
						this.organization = organization;
						if (employee && employee.id) {
							this.logRequest.employeeIds = [employee.id];
						} else {
							delete this.logRequest.employeeIds;
						}
						if (project && project.id) {
							this.logRequest.projectIds = [project.id];
						} else {
							delete this.logRequest.projectIds;
						}
						this.updateLogs$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.updateLogs$.next();
	}

	updateChartData() {
		if (!this.organization || !this.logRequest) {
			return;
		}

		const { startDate, endDate } = this.logRequest;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const appliedFilter = pick(
			this.logRequest,
			'projectIds',
			'employeeIds'
		);

		const request: IGetExpenseInput = {
			...appliedFilter,
			organizationId,
			tenantId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			groupBy: this.groupBy
		};

		this.loading = true;
		this.timesheetService
			.getOwedAmountReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: this.getTranslation('REPORT_PAGE.AMOUNT'),
						data: logs.map((log) => log.value)
					}
				];
				this.chartData = {
					labels: pluck(logs, 'date'),
					datasets
				};
			})
			.finally(() => (this.loading = false));
	}
}
