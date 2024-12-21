import { Component, OnDestroy } from '@angular/core';
import { filter, merge, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy()
@Component({
    selector: 'gz-proposal-layout',
    template: ` <router-outlet></router-outlet>`,
    styles: [
        `
			:host {
				height: 100%;
				display: block;
			}
		`
    ],
    standalone: false
})
export class ProposalLayoutComponent implements OnDestroy {
	constructor(
		readonly _translateService: TranslateService,
		readonly _ngxPermissionsService: NgxPermissionsService,
		readonly _store: Store,
		readonly _i18nService: I18nService
	) {
		this.initializeUiPermissions(); // Initialize UI permissions
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
	}

	/**
	 * Initialize UI permissions
	 */
	private initializeUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
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
				this._translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}

	/**
	 * Unsubscribe from all subscriptions
	 */
	ngOnDestroy(): void {}
}
