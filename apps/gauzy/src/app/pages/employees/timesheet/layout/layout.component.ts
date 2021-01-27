import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	tabs = [
		{
			title: this.getTranslation('TIMESHEET.DAILY'),
			route: '/pages/employees/timesheets/daily'
		},
		{
			title: this.getTranslation('TIMESHEET.WEEKLY'),
			route: '/pages/employees/timesheets/weekly'
		},
		{
			title: this.getTranslation('TIMESHEET.CALENDAR'),
			route: '/pages/employees/timesheets/calendar'
		}
	];

	constructor(
		private ngxPermissionsService: NgxPermissionsService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.ngxPermissionsService
					.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET)
					.then((hasPermission) => {
						if (hasPermission) {
							this.tabs[3] = {
								title: this.getTranslation(
									'TIMESHEET.APPROVALS'
								),
								route: '/pages/employees/timesheets/approvals'
							};
						}
					});
			});
	}

	ngOnDestroy() {}
}
