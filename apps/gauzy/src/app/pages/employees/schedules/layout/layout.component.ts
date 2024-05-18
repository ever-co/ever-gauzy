import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';

@Component({
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent extends TranslationBaseComponent implements OnInit {
	tabs = [
		{
			title: this.getTranslation('SCHEDULE.RECURRING_AVAILABILITY'),
			route: '/pages/employees/schedules/recurring-availability'
		},
		{
			title: this.getTranslation('SCHEDULE.DATE_SPECIFIC_AVAILABILITY'),
			route: '/pages/employees/schedules/date-specific-availability'
		}
	];

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}
