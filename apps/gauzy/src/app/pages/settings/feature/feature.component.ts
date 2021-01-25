import { Component, OnInit } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-feature',
	templateUrl: './feature.component.html',
	styleUrls: ['./feature.component.scss']
})
export class FeatureComponent
	extends TranslationBaseComponent
	implements OnInit {
	tabs: any[];
	organization: IOrganization;

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('MENU.TENANT'),
				route: this.getRoute('tenant')
			},
			{
				title: this.getTranslation('MENU.ORGANIZATION'),
				route: this.getRoute('organization')
			}
		];
	}

	getRoute(tab: string): string {
		return `/pages/settings/features/${tab}`;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
