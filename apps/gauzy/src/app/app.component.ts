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
import { environment } from '../environments/environment';

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
		if (environment.CHATWOOT_SDK_TOKEN) {
			this.loadChatwoot(document, 'script');
		}
		this.analytics.trackPageViews();
		this.translate.onLangChange.subscribe(() => {
			this.loading = false;
		});
		this.loadLanguages();

		if (Number(this.store.serverConnection) === 0) {
			this.loading = false;
		}
	}

	private async loadLanguages() {
		const res = await this.languagesService.getSystemLanguages();
		this.store.systemLanguages = res.items;
		this.translate.setDefaultLang(LanguagesEnum.ENGLISH);
		this.translate.use(
			this.translate.getBrowserLang() || LanguagesEnum.ENGLISH
		);
	}

	private loadChatwoot(d, t) {
		var BASE_URL = 'https://app.chatwoot.com';
		var g = d.createElement(t),
			s = d.getElementsByTagName(t)[0];
		g.src = BASE_URL + '/packs/js/sdk.js';
		s.parentNode.insertBefore(g, s);
		g.onload = function () {
			window['chatwootSDK'].run({
				websiteToken: environment.CHATWOOT_SDK_TOKEN,
				baseUrl: BASE_URL
			});
		};
	}
}
