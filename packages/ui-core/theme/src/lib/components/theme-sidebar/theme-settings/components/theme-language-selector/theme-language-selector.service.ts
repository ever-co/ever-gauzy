import { Injectable } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, from, tap } from 'rxjs';
import { NbLayoutDirection, NbLayoutDirectionService } from '@nebular/theme';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { ElectronService, Store } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class ThemeLanguageSelectorService {
	/**
	 * Preferred language
	 */
	private _preferredLanguage: LanguagesEnum;
	public get preferredLanguage(): LanguagesEnum {
		return this._preferredLanguage;
	}
	public set preferredLanguage(value: LanguagesEnum) {
		this._preferredLanguage = value;
	}

	constructor(
		private readonly _store: Store,
		private readonly _electronService: ElectronService,
		private readonly _directionService: NbLayoutDirectionService,
		private readonly _i18nService: I18nService
	) {
		this._preferredLanguage = LanguagesEnum.ENGLISH;
	}

	public initialize(): void {
		this._store.preferredLanguage$
			.pipe(
				distinctUntilChange(),
				filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
				tap((preferredLanguage: LanguagesEnum) => (this.preferredLanguage = preferredLanguage)),
				tap(() => this.setLanguage()),
				tap((preferredLanguage: LanguagesEnum) => {
					if (this._electronService.isElectron) {
						this._electronService.ipcRenderer.send('preferred_language_change', preferredLanguage);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		if (this._electronService.isElectron) {
			from(this._electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
				.pipe(
					tap((language: LanguagesEnum) => {
						this._store.preferredLanguage = language;
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	/**
	 * Sets the application language and layout direction based on the preferred language.
	 */
	public setLanguage(): void {
		const isRtl = [LanguagesEnum.HEBREW, LanguagesEnum.ARABIC].includes(this.preferredLanguage);
		// Set the layout direction
		this._directionService.setDirection(isRtl ? NbLayoutDirection.RTL : NbLayoutDirection.LTR);
		// Set the language
		this._i18nService.setLanguage(this.preferredLanguage);
	}
}
