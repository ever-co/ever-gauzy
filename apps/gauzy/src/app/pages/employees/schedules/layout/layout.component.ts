import { Component, OnInit } from '@angular/core';

@Component({
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
	tabs = [
		{
			title: 'Date Specific Availibility',
			route: '/pages/employees/schedules/date-specific-availibility'
		},
		{
			title: 'Recurring Availibility',
			route: '/pages/employees/schedules/recurring-availibility'
		}
	];

	constructor() {}

	ngOnInit() {}
}
