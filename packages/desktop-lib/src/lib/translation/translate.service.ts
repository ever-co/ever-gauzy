import { TranslateLoader } from './translate.loader';
import { LocalStore } from '../desktop-store';
import { TranslateEventManager } from './translate-event-manager';
import { LanguagesEnum } from '@gauzy/contracts';

export class TranslateService {
	private constructor() { }
	public static instant(key: string, interpolateParams?: Object): string {
		const translations =
			TranslateLoader.translations[this.preferredLanguage];
		if (key in translations) {
			return this._interpolate(
				translations[key],
				interpolateParams || {}
			);
		}
		return key;
	}

	private static _interpolate(
		translation: string,
		interpolateParams?: Object
	): string {
		return translation.replace(/{{\s*([^}\s]+)\s*}}/g, (match, name) => {
			return interpolateParams[name.trim()] || match;
		});
	}

	public static onLanguageChange<T>(listener: (language?: string) => T) {
		TranslateEventManager.listen(listener);
	}

	public static get preferredLanguage(): string {
		const setting = LocalStore.getStore('appSetting');
		return setting?.preferredLanguage || LanguagesEnum.ENGLISH;
	}

	public static set preferredLanguage(value: string) {
		LocalStore.updateApplicationSetting({ preferredLanguage: value });
		TranslateEventManager.trigger(value);
	}
}
