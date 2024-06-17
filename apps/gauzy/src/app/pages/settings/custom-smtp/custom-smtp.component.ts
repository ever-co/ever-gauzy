import { Component, OnInit } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-custom-smtp',
	templateUrl: './custom-smtp.component.html',
	styleUrls: ['./custom-smtp.component.scss']
})
export class CustomSmtpComponent extends TranslationBaseComponent implements OnInit {
	tabs: NbRouteTab[] = [];

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadTabs();
		this._applyTranslationOnTabs();
	}

	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('MENU.TENANT'),
				route: this._getRoute('tenant'),
				queryParamsHandling: 'merge'
			},
			{
				title: this.getTranslation('MENU.ORGANIZATION'),
				route: this._getRoute('organization'),
				queryParamsHandling: 'merge'
			}
		];
	}

	private _getRoute(tab: string): string {
		return `/pages/settings/custom-smtp/${tab}`;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
