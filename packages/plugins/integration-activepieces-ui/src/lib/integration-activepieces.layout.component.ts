import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, merge, tap, catchError, EMPTY, distinctUntilChanged } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LanguagesEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-integration-activepieces-layout',
	template: `<router-outlet></router-outlet>`,
	standalone: false
})
export class IntegrationActivepiecesLayoutComponent implements OnInit, OnDestroy {
	constructor(
		private readonly _translateService: TranslateService,
		private readonly _store: Store,
		private readonly _i18nService: I18nService
	) {}

	ngOnInit() {
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(
			this._store.preferredLanguage$,
			this._i18nService.preferredLanguage$
		).pipe(
			distinctUntilChanged(),
			filter((lang: string | LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				this._translateService.use(lang);
			}),
			catchError((error) => {
				console.error('Failed to load language translations:', error);
				return EMPTY;
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}

	ngOnDestroy(): void {}
}
