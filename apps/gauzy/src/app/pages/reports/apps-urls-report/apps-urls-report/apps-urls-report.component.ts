import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { IGetActivitiesInput } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { Store } from './../../../../@core/services';
import { ReportBaseComponent } from './../../../../@shared/report/report-base/report-base.component';

@Component({
	selector: 'ga-apps-urls-report',
	templateUrl: './apps-urls-report.component.html',
	styleUrls: ['./apps-urls-report.component.scss']
})
export class AppsUrlsReportComponent 
	extends ReportBaseComponent 
	implements OnInit, AfterViewInit, OnDestroy {
		
	today: Date = new Date();
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

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign(
			{},
			this.logRequest,
			this.getAdjustDateRangeFutureAllowed(this.logRequest)
		);
	}

	ngOnDestroy() {}
}