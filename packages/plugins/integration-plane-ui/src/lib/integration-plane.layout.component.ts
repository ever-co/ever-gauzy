import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, merge, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-integration-plane-layout',
	template: `<router-outlet></router-outlet>`,
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntegrationPlaneLayoutComponent implements OnInit {
	private readonly _translateService = inject(TranslateService);
	private readonly _store = inject(Store);
	private readonly _i18nService = inject(I18nService);

	ngOnInit() {
		this.initializeUiLanguagesAndLocale();
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((lang: string | LanguagesEnum) => !!lang && Object.values(LanguagesEnum).includes(lang as LanguagesEnum)),
			tap((lang: string | LanguagesEnum) => {
				this._translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		preferredLanguage$.subscribe();
	}
}
