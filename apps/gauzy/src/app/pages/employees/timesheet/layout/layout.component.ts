import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
	tabs = [
		{
			title: 'Daily',
			route: '/pages/employees/timesheets/daily'
		},
		{
			title: 'Weekly',
			route: '/pages/employees/timesheets/weekly'
		},
		{
			title: 'Calendar',
			route: '/pages/employees/timesheets/calendar'
		},
		{
			title: 'Approvals',
			route: '/pages/employees/timesheets/approvals'
		}
	];

	constructor() {}

	ngOnInit() {}
}
