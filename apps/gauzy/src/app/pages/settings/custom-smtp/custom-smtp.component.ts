import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-tenant-custom-smtp',
	templateUrl: './custom-smtp.component.html',
	styleUrls: ['./custom-smtp.component.css']
})
export class CustomSmtpComponent
	extends TranslationBaseComponent
	implements OnInit {
	tabs: any[];

	constructor(public readonly translateService: TranslateService) {
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
		return `/pages/settings/custom-smtp/${tab}`;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
