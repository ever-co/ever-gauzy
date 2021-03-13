/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { AnalyticsService } from './@core/utils/analytics.service';
import { Store } from './@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { LanguagesService } from './@core/services/languages.service';
import { environment } from '../environments/environment';

@Component({
	selector: 'ga-app',
	template: '<router-outlet *ngIf="!loading"></router-outlet>'
})
export class AppComponent implements OnInit, AfterViewInit {
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

		this.translate.setDefaultLang(LanguagesEnum.ENGLISH);
		this.translate.use(
			this.translate.getBrowserLang() || LanguagesEnum.ENGLISH
		);
		this.translate.onLangChange.subscribe(() => {
			this.loading = false;
		});

		if (Number(this.store.serverConnection) === 0) {
			this.loading = false;
		}
	}

	ngAfterViewInit() {
		this.loadLanguages();
	}

	private async loadLanguages() {
		this.languagesService.getSystemLanguages().then(({ items }) => {
			this.store.systemLanguages = items;
		});
	}

	private loadChatwoot(d, t) {
		var chatwootBaseUrl = 'https://app.chatwoot.com';
		var g = d.createElement(t),
			s = d.getElementsByTagName(t)[0];
		g.src = chatwootBaseUrl + '/packs/js/sdk.js';
		s.parentNode.insertBefore(g, s);
		g.onload = function () {
			window['chatwootSDK'].run({
				websiteToken: environment.CHATWOOT_SDK_TOKEN,
				baseUrl: chatwootBaseUrl
			});
		};
	}
}
