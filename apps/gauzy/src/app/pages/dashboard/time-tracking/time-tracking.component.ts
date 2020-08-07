import { Component, OnDestroy, OnInit } from '@angular/core';
import { TimesheetService } from '../../../@shared/timesheet/timesheet.service';

@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html'
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
	timeSlotEmployees = [];
	recentActivities = [];
	projects = [];
	members = [];

	constructor(private timesheetService: TimesheetService) {}

	ngOnInit() {
		// this.timesheetService.getTimeSlotsStatic().then((resp) => {
		// 	console.log(resp);
		// 	this.timeSlotEmployees = resp;
		// });
	}

	ngOnDestroy() {}
}
