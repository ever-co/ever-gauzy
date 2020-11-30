import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { IGetExpenseInput, IOrganization } from '@gauzy/models';
import * as moment from 'moment';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-expenses-report',
	templateUrl: './expenses-report.component.html',
	styleUrls: ['./expenses-report.component.scss']
})
export class ExpensesReportComponent implements OnInit, AfterViewInit {
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

	constructor(private cd: ChangeDetectorRef) {}

	ngOnInit() {}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange($event) {
		this.logRequest = $event;
		this.filters = Object.assign({}, this.logRequest);
		this.updateLogs$.next();
	}
}
