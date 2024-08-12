import { Injectable } from '@angular/core';
import { ITranslatable, LanguagesEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class TranslatableService {
	constructor(private readonly translateService: TranslateService) { }

	/**
	 * Retrieves the translated properties of an ITranslatable object based on the current language.
	 *
	 * @param {ITranslatable<any>} translatable - The ITranslatable object to be translated.
	 * @param {string[]} translateProps - An array of property names to be translated.
	 * @return {any} The translated ITranslatable object.
	 */
	getTranslated(translatable: ITranslatable<any>, translateProps: string[]): any {
		if (!translatable || !Array.isArray(translatable.translations)) {
			console.warn('Invalid translatable object or translations property:', translatable);
			return translatable;
		}
		const currentLangCode = this.translateService.currentLang || LanguagesEnum.ENGLISH;
		const currentLangTranslation = translatable.translations.find((tr) => tr.languageCode == currentLangCode);

		translateProps.forEach((prop) => {
			if (currentLangTranslation) {
				translatable[prop] = currentLangTranslation[prop];
			} else {
				translatable[prop] = '(No Translation)';
			}
		});

		return translatable;
	}

	/**
	 * Retrieves the translated value of a specific property from an ITranslatable object based on the current language.
	 *
	 * @param {ITranslatable<any>} translatable - The ITranslatable object to be translated.
	 * @param {string} translateProperty - The name of the property to be translated.
	 * @return {string} The translated value of the specified property.
	 */
	getTranslatedProperty(translatable: ITranslatable<any>, translateProperty: string): string {
		if (!translatable || !translateProperty) {
			console.warn('Invalid translatable object or translation property:', translatable, translateProperty);
			return null;
		}
		return this.getTranslated({ ...translatable }, [translateProperty])[translateProperty];
	}
}
