import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { IGetActivitiesInput, ITimeLogFilters } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { DateRangePickerBuilderService, TimesheetFilterService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, i4netFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-apps-urls-report',
	templateUrl: './apps-urls-report.component.html',
	styleUrls: ['./apps-urls-report.component.scss']
})
export class AppsUrlsReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	filters: IGetActivitiesInput;

	@ViewChild(i4netFiltersComponent) gauzyFiltersComponent: i4netFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly cd: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() { }

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
	}

	ngOnDestroy() { }
}
