import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnDestroy,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IReportDayData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum,
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pick } from 'underscore';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-daily-grid',
	templateUrl: './daily-grid.component.html',
	styleUrls: ['./daily-grid.component.scss']
})
export class DailyGridComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit, OnDestroy {
	
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	dailyLogs: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	ReportGroupFilterEnum = ReportGroupFilterEnum;

	/*
	* Getter & Setter for dynamic filters
	*/
	private _filters: ITimeLogFilters = this.request;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.subject$.next(true);
		}
	}

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.prepareRequest()),
				untilDestroyed(this),
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}
	
	groupByChange() {
		this.subject$.next(true);
	}

	prepareRequest() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		}
		this.payloads$.next(request);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		try {
			this.dailyLogs = await this.timesheetService.getDailyReport(payloads);
		} catch (error) {
			console.log('Error while retrieving daily logs report', error);
		} finally {
			this.loading = false;
		}
	}

	ngOnDestroy() {}
}
