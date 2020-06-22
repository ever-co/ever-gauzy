import { Component, OnInit, OnDestroy } from '@angular/core';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { RouteUtil } from 'apps/gauzy/src/app/@core/services/route-utils';

@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss'],
	providers: [RouteUtil]
})
export class LayoutComponent implements OnInit, OnDestroy {
	title: any;
	tabs: any[] = [
		{
			title: 'Screenshots',
			route: '/pages/employees/activity/screenshots'
		},
		{
			title: 'Apps',
			route: '/pages/employees/activity/apps'
		},
		{
			title: 'Urls',
			route: '/pages/employees/activity/urls'
		}
	];

	constructor(private routeUtil: RouteUtil) {
		this.routeUtil.data$.pipe(untilDestroyed(this)).subscribe((data) => {
			this.title = data.title;
		});
	}

	ngOnInit(): void {}

	ngOnDestroy(): void {}
}
