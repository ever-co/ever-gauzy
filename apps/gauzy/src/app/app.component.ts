/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { Component, OnInit } from '@angular/core';
import { AnalyticsService } from './@core/utils/analytics.service';
import { Store } from './@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/models';
import { LanguagesService } from './@core/services/languages.service';

@Component({
	selector: 'ga-app',
	template: '<router-outlet *ngIf="!loading"></router-outlet>'
})
export class AppComponent implements OnInit {
	constructor(
		private analytics: AnalyticsService,
		private store: Store,
		private languagesService: LanguagesService,
		public translate: TranslateService
	) {}

	loading = true;

	async ngOnInit() {
		this.analytics.trackPageViews();
		this.translate.onLangChange.subscribe(() => {
			this.loading = false;
		});
		this.loadLanguages();
	}

	private async loadLanguages() {
		const res = await this.languagesService.getSystemLanguages();
		this.store.systemLanguages = res.items;
		this.translate.setDefaultLang(LanguagesEnum.ENGLISH);
		this.translate.use(
			this.translate.getBrowserLang() || LanguagesEnum.ENGLISH
		);
	}
}
