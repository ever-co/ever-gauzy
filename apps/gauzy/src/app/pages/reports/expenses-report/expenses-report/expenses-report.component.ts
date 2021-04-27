import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ExpensesService } from 'apps/gauzy/src/app/@core/services/expenses.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import * as moment from 'moment';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { pick, pluck } from 'underscore';
import { toUTC } from '@gauzy/common-angular';

@UntilDestroy()
@Component({
	selector: 'ga-expenses-report',
	templateUrl: './expenses-report.component.html',
	styleUrls: ['./expenses-report.component.scss']
})
export class ExpensesReportComponent
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

	private _selectedDate: Date = new Date();
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	filters: IGetExpenseInput;

	public get selectedDate(): Date {
		return this._selectedDate;
	}
	public set selectedDate(value: Date) {
		this._selectedDate = value;
	}

	constructor(
		private expensesService: ExpensesService,
		private cd: ChangeDetectorRef,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.updateLogs$
			.pipe(debounceTime(500), untilDestroyed(this))
			.subscribe(() => {
				this.updateChartData();
			});

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
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm'),
			organizationId,
			tenantId,
			groupBy: this.groupBy
		};

		this.loading = true;
		this.expensesService
			.getReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: this.getTranslation('REPORT_PAGE.EXPANSE'),
						data: logs.map((log) => log.value['expanse'])
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
