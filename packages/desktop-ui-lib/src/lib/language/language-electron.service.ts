import { Injectable, NgZone } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from 'packages/contracts/dist';
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

	public initialize<T>(callback?: T) {
		this.electronService.ipcRenderer.on('preferred_language_change', (event, language: LanguagesEnum) => {
			this.ngZone.run(() => {
				this.languageSelectorService.setLanguage(language, this.translateService);
				TimeTrackerDateManager.locale(language);
				if (callback) {
					callback;
				}
			});
		});

		from(this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this.languageSelectorService.setLanguage(language, this.translateService);
					TimeTrackerDateManager.locale(language);
					console.log('PREFERRED_LANGUAGE', language);
					if (callback) {
						callback;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
