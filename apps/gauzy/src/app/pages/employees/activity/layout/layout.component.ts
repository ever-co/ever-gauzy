import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { RouteUtil } from 'apps/gauzy/src/app/@core/services/route-utils';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss'],
	providers: [RouteUtil]
})
export class LayoutComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	title: any;
	tabs: any[] = [
		{
			title: this.getTranslation('ACTIVITY.TIME_AND_ACTIVITIES'),
			route: '/pages/employees/activity/time-activities'
		},
		{
			title: this.getTranslation('ACTIVITY.SCREENSHOTS'),
			route: '/pages/employees/activity/screenshots'
		},
		{
			title: this.getTranslation('ACTIVITY.APPS'),
			route: '/pages/employees/activity/apps'
		},
		{
			title: this.getTranslation('ACTIVITY.VISITED_SITES'),
			route: '/pages/employees/activity/urls'
		}
	];

	constructor(
		private routeUtil: RouteUtil,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.routeUtil.data$.pipe(untilDestroyed(this)).subscribe((data) => {
			this.title = data.title;
		});
	}

	ngOnInit(): void {}

	ngOnDestroy(): void {}
}
