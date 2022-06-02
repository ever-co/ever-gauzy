import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import {
	IGetPaymentInput,
	IGetTimeLogReportInput,
	IClientBudgetLimitReport,
	OrganizationContactBudgetTypeEnum,
	ITimeLogFilters
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-client-budgets-report',
	templateUrl: './client-budgets-report.component.html',
	styleUrls: ['./client-budgets-report.component.scss']
})
export class ClientBudgetsReportComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit {
		
	OrganizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;
	loading: boolean;
	filters: IGetPaymentInput;
	clients: IClientBudgetLimitReport[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(1350),
				tap(() => this.getClientBudgetReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	async getClientBudgetReport() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const appliedFilter = pick(this.request, 'clientIds');
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
		this.loading = true;
		try {
			const clients: IClientBudgetLimitReport[] = await this.timesheetService.getClientBudgetLimit(request);
			this.clients = clients;
		}  catch (error) {
			console.log('Error while retrieving client budget reports', error);
		} finally {
			this.loading = false;
		}
	}
}
