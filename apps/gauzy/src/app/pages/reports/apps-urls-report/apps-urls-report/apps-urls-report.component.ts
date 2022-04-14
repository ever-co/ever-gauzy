import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { IGetActivitiesInput, ITimeLogFilters } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { Store } from './../../../../@core/services';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@Component({
	selector: 'ga-apps-urls-report',
	templateUrl: './apps-urls-report.component.html',
	styleUrls: ['./apps-urls-report.component.scss']
})
export class AppsUrlsReportComponent extends BaseSelectorFilterComponent 
	implements OnInit, AfterViewInit, OnDestroy {
		
	logRequest: IGetActivitiesInput = this.request;
	filters: IGetActivitiesInput;

	constructor(
		private readonly cd: ChangeDetectorRef,
    	private readonly activatedRoute: ActivatedRoute,
		protected readonly store: Store,
		public readonly translateService: TranslateService
    ) {
		super(store, translateService);
	}

	ngOnInit() {
		this.cd.detectChanges();
  	}

	ngAfterViewInit() {
		this.activatedRoute.queryParams
			.pipe(
				filter((params) => !!params && params.start),
				tap((params) => this.filtersChange({
					startDate: moment(params.start).startOf('week').toDate(),
					endDate: moment(params.end).endOf('week').toDate()
				}))
			)
			.subscribe();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.filters = Object.assign(
			{},
			this.logRequest,
			getAdjustDateRangeFutureAllowed(this.logRequest)
		);
	}

	ngOnDestroy() {}
}