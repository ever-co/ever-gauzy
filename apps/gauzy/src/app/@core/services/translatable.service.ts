import { Injectable } from '@angular/core';
import { ITranslatable, LanguagesEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class TranslatableService {
	constructor(private translateService: TranslateService) {}

	getTranslated(
		translatable: ITranslatable<any>,
		translateProps: string[]
	): any {
		const currentLangCode =
			this.translateService.currentLang || LanguagesEnum.ENGLISH;
		const currentLangTranslation = translatable.translations.find(
			(tr) => tr.languageCode == currentLangCode
		);

		translateProps.forEach((prop) => {
			if (currentLangTranslation) {
				translatable[prop] = currentLangTranslation[prop];
			} else {
				translatable[prop] = '(No Translation)';
			}
		});

		return translatable;
	}

	getTranslatedProperty(
		translatable: ITranslatable<any>,
		translateProperty: string
	): string {
		return this.getTranslated({ ...translatable }, [translateProperty])[
			translateProperty
		];
	}
}
