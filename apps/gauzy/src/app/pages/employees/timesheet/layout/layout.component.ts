import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-layout',
	templateUrl: './layout.component.html',
	styleUrls: ['./layout.component.scss']
})
export class LayoutComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
	
	tabs: any[] = [];

	constructor(
		private readonly ngxPermissionsService: NgxPermissionsService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.ngxPermissionsService.permissions$
			.pipe(
				tap(() => this._createContextTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnChange();
	}

	private _createContextTabs() {
		this.tabs = [
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
		this.ngxPermissionsService
			.hasPermission(PermissionsEnum.CAN_APPROVE_TIMESHEET)
			.then((hasPermission) => {
				if (hasPermission) {
					this.tabs.push({
						title: this.getTranslation('TIMESHEET.APPROVALS'),
						route: '/pages/employees/timesheets/approvals'
					});
				}
			});
	}

	/**
	 * Translate context menus
	 */
	 private _applyTranslationOnChange() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._createContextTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
