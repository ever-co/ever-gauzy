import { Injectable, NgZone } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { from, tap } from 'rxjs';
import { ElectronService } from '../electron/services';
import { TimeTrackerDateManager } from '../services';
import { LanguageSelectorService } from './language-selector.service';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class LanguageElectronService {
	constructor(
		private readonly electronService: ElectronService,
		private readonly languageSelectorService: LanguageSelectorService,
		private readonly translateService: TranslateService,
		private readonly ngZone: NgZone
	) {}

	private desktopPreferredLanguage() {
		try {
			return this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE');
		} catch(error) {
			return Promise.resolve('en');
		}
	}

	public initialize<T>(callback?: T) {
		this.onLanguageChange(callback);

		from(this.desktopPreferredLanguage())
			.pipe(
				tap((language: LanguagesEnum) => {
					this.languageSelectorService.setLanguage(language, this.translateService);
					TimeTrackerDateManager.locale(language);
					if (callback) {
						callback;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onLanguageChange<T>(callback?: T) {
		this.electronService?.ipcRenderer?.on('preferred_language_change', (event, language: LanguagesEnum) => {
			this.ngZone.run(() => {
				this.languageSelectorService.setLanguage(language, this.translateService);
				TimeTrackerDateManager.locale(language);
				if (callback) {
					callback;
				}
			});
		});
	}
}
