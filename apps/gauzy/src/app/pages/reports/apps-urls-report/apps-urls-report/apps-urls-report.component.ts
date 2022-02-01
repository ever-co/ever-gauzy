import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IGetActivitiesInput } from '@gauzy/contracts';
import * as moment from 'moment';

@Component({
	selector: 'ga-apps-urls-report',
	templateUrl: './apps-urls-report.component.html',
	styleUrls: ['./apps-urls-report.component.scss']
})
export class AppsUrlsReportComponent implements OnInit, AfterViewInit, OnDestroy {
	today: Date = new Date();
	logRequest: IGetActivitiesInput = {
		startDate: moment(this.today).startOf('week').toDate(),
		endDate: moment(this.today).endOf('week').toDate()
	};
	filters: IGetActivitiesInput;
  customFilterRange: IGetActivitiesInput;

	constructor(private readonly cd: ChangeDetectorRef,
    private readonly route: ActivatedRoute
    ) {}

	ngOnInit() {
    this.customFilterRange = {
      startDate: moment(this.route.snapshot.queryParams.start).startOf('week').toDate(),
      endDate: moment(this.route.snapshot.queryParams.end).endOf('week').toDate()
    };
    if(this.customFilterRange.startDate) {
      this.filtersChange(this.customFilterRange);
    };
  }

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
	}

	ngOnDestroy() {}
}
