import { Component, OnInit, Input, Output } from '@angular/core';
import { Employee } from '@gauzy/models';

@Component({
	selector: 'ngx-date-row',
	templateUrl: './date-row.component.html',
	styleUrls: ['../time-calendar.component.scss']
})
export class DateRowComponent implements OnInit {
	@Input() visibleDates: Date[];
	@Input() employee: Employee;

	constructor() {}

	ngOnInit() {}
}
