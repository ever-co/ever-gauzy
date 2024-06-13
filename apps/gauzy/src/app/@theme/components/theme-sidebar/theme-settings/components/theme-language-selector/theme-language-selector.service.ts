import { Injectable } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, from, tap } from 'rxjs';
import { Store } from '@gauzy/ui-core/common';
import { NbLayoutDirection, NbLayoutDirectionService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ElectronService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class ThemeLanguageSelectorService {
	private _preferredLanguage: LanguagesEnum;

	constructor(
		private readonly _store: Store,
		private readonly _electronService: ElectronService,
		private readonly _directionService: NbLayoutDirectionService,
		private readonly _translate: TranslateService
	) {
		this._preferredLanguage = LanguagesEnum.ENGLISH;
	}

	public initialize(): void {
		this._store.preferredLanguage$
			.pipe(
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

	public setLanguage(): void {
		if (this.preferredLanguage === LanguagesEnum.HEBREW || this.preferredLanguage === LanguagesEnum.ARABIC) {
			this._directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this._directionService.setDirection(NbLayoutDirection.LTR);
		}
		this._translate.use(this.preferredLanguage);
	}

	public get preferredLanguage(): LanguagesEnum {
		return this._preferredLanguage;
	}

	public set preferredLanguage(value: LanguagesEnum) {
		this._preferredLanguage = value;
	}
}
