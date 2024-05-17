import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterContentChecked } from '@angular/core';
import { QueryParamsHandling } from '@angular/router';
import { tap } from 'rxjs/operators';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from './../../../../@core/services';
import { RouteUtil } from './../../../../@core/services/route-utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activity-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss'],
	providers: [RouteUtil]
})
export class ActivityLayoutComponent
	extends TranslationBaseComponent
	implements AfterContentChecked, OnInit, OnDestroy
{
	public title: string;
	public tabs: NbRouteTab[] = [];

	constructor(
		private readonly cdr: ChangeDetectorRef,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly routeUtil: RouteUtil
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadTabs();
		this._applyTranslationOnTabs();

		this.routeUtil.data$
			.pipe(
				tap((data) => (this.title = data.title)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterContentChecked(): void {
		this.cdr.detectChanges();
	}

	private _loadTabs() {
		this.tabs = [
			...(this.store.hasAnyPermission(
				PermissionsEnum.ADMIN_DASHBOARD_VIEW,
				PermissionsEnum.TIME_TRACKING_DASHBOARD,
				PermissionsEnum.TIME_TRACKER
			)
				? [
						{
							title: this.getTranslation('ACTIVITY.TIME_AND_ACTIVITIES'),
							responsive: true,
							route: '/pages/employees/activity/time-activities',
							queryParamsHandling: 'merge' as QueryParamsHandling
						},
						{
							title: this.getTranslation('ACTIVITY.SCREENSHOTS'),
							responsive: true,
							route: '/pages/employees/activity/screenshots',
							queryParamsHandling: 'merge' as QueryParamsHandling
						},
						{
							title: this.getTranslation('ACTIVITY.APPS'),
							responsive: true,
							route: '/pages/employees/activity/apps',
							queryParamsHandling: 'merge' as QueryParamsHandling
						},
						{
							title: this.getTranslation('ACTIVITY.VISITED_SITES'),
							responsive: true,
							route: '/pages/employees/activity/urls',
							queryParamsHandling: 'merge' as QueryParamsHandling
						}
				  ]
				: [])
		];
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
