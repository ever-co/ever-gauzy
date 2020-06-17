import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/models';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit, OnDestroy {
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
		}
	];

	constructor(private ngxPermissionsService: NgxPermissionsService) {}
	ngOnInit() {
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.ngxPermissionsService
					.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET)
					.then((hasPermission) => {
						if (hasPermission) {
							this.tabs[3] = {
								title: 'Approvals',
								route: '/pages/employees/timesheets/approvals'
							};
						}
					});
			});
	}

	ngOnDestroy() {}
}
