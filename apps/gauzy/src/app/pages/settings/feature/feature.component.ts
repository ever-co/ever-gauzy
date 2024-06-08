import { Component, OnInit } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-feature',
	templateUrl: './feature.component.html',
	styleUrls: ['./feature.component.scss']
})
export class FeatureComponent extends TranslationBaseComponent implements OnInit {
	public tabs: NbRouteTab[] = [];
	public organization: IOrganization;

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
				route: this.getRoute('tenant'),
				queryParamsHandling: 'merge'
			},
			{
				title: this.getTranslation('MENU.ORGANIZATION'),
				route: this.getRoute('organization'),
				queryParamsHandling: 'merge'
			}
		];
	}

	getRoute(tab: string): string {
		return `/pages/settings/features/${tab}`;
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
