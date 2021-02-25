import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import {
	IGetExpenseInput,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ExpensesService } from 'apps/gauzy/src/app/@core/services/expenses.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import * as moment from 'moment';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { pluck } from 'underscore';

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
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.updateChartData();
			});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.updateLogs$.next();
				}
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee: ISelectedEmployee) => {
				if (employee && employee.id) {
					this.logRequest.employeeIds = [employee.id];
				} else {
					delete this.logRequest.employeeIds;
				}
				this.updateLogs$.next();
			});

		this.updateLogs$.next();
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
		const request: IGetExpenseInput = {
			startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
			organizationId: this.organization ? this.organization.id : null,
			tenantId: this.organization ? this.organization.tenantId : null,
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
