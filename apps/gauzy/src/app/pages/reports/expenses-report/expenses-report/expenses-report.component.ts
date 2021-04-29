import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ExpensesService } from './../../../../@core/services/expenses.service';
import { Store } from './../../../../@core/services/store.service';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';
import { debounceTime } from 'rxjs/operators';
import { pluck } from 'underscore';

@UntilDestroy()
@Component({
	selector: 'ga-expenses-report',
	templateUrl: './expenses-report.component.html',
	styleUrls: ['./expenses-report.component.scss']
})
export class ExpensesReportComponent
	extends ReportBaseComponent
	implements OnInit, AfterViewInit {
	logRequest: IGetExpenseInput = this.request;
	loading: boolean;
	chartData: any;
	groupBy: 'date' | 'employee' | 'project' | 'client' = 'date';
	filters: IGetExpenseInput;

	constructor(
		private expensesService: ExpensesService,
		private cd: ChangeDetectorRef,
		protected store: Store,
		readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(debounceTime(1350), untilDestroyed(this))
			.subscribe(() => {
				this.updateChartData();
			});
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.subject$.next();
	}

	updateChartData() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.loading = true;
		this.expensesService
			.getReportChartData(request)
			.then((logs: any[]) => {
				const datasets = [
					{
						label: this.getTranslation('REPORT_PAGE.EXPANSE'),
						data: logs.map((log) => log.value['expense'])
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
