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
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pick } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
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
	loading: boolean = false;
	filters: IGetPaymentInput;
	clients: IClientBudgetLimitReport[] = [];

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getClientBudgetReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(this.request, 'clientIds');
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Get client budget report
	 *
	 * @returns
	 */
	async getClientBudgetReport() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			const clients: IClientBudgetLimitReport[] = await this.timesheetService.getClientBudgetLimit(payloads);
			this.clients = clients;
		}  catch (error) {
			console.log('Error while retrieving client budget reports', error);
		} finally {
			this.loading = false;
		}
	}
}
