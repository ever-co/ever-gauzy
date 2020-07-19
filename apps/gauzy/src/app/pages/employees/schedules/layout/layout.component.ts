import { Component, OnInit } from '@angular/core';

@Component({
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
	tabs = [
		{
			title: 'Date Specific Availability',
			route: '/pages/employees/schedules/date-specific-availability'
		},
		{
			title: 'Recurring Availability',
			route: '/pages/employees/schedules/recurring-availability'
		}
	];

	constructor() {}

	ngOnInit() {}
}
