import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, merge, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: '</ngx-integration-upwork-layout>',
	template: `<router-outlet></router-outlet>`
})
export class IntegrationUpworkLayoutComponent implements OnInit, OnDestroy {
	constructor(
		private readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _i18nService: I18nService
	) {}

	ngOnInit() {
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
		console.log(`Integration Upwork UI module plugin initialized`);
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((lang: string | LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				console.log('integration upwork ui module plugin lang', lang);
				this._translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}

	ngOnDestroy(): void {
		console.log(`Integration Upwork UI module plugin destroyed`);
	}
}
