import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
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

	constructor(private readonly cd: ChangeDetectorRef) {}

	ngOnInit() {}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
	}

	ngOnDestroy() {}
}
