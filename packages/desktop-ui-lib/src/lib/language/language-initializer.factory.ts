import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

export function LanguageInitializerFactory(translate: TranslateService, electronService: ElectronService) {
	return async () => {
		const DEFAULT_LANG = LanguagesEnum.ENGLISH;
		const languages = Object.values(LanguagesEnum);

		translate.addLangs(languages);
		translate.setFallbackLang(DEFAULT_LANG);

		let language: string = DEFAULT_LANG;

		if (electronService.isElectron) {
			try {
				const preferredLanguage = await electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE');
				if (preferredLanguage) {
					// Validate that preferredLanguage is a supported value
					if (languages.includes(preferredLanguage as LanguagesEnum)) {
						language = preferredLanguage;
					} else {
						console.warn(
							`Invalid preferred language '${preferredLanguage}' from Electron. Falling back to default language.`
						);
					}
				}
			} catch (error) {
				console.warn('Error getting preferred language from Electron:', error);
			}
		}

		return await firstValueFrom(translate.use(language));
	};
}
