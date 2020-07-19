import { Base } from './base';
import {
	Translation as ITranslation,
	Translatable as ITranslatable
} from '@gauzy/models';

export abstract class TranslationBase extends Base
	implements ITranslation<TranslatableBase> {
	reference: ITranslatable<TranslatableBase>;
	languageCode: string;
}

export abstract class TranslatableBase extends Base
	implements ITranslatable<TranslationBase> {
	translations: ITranslation<TranslationBase>[];

	translate(langCode: string): any {
		if (!this.translations) return this;

		const translationObj = this.translations.find((translation) => {
			return translation.languageCode === langCode;
		});

		if (!translationObj) return this;

		for (const prop of Object.keys(translationObj)) {
			if (!['id', 'languageCode'].includes(prop)) {
				this[prop] = translationObj[prop];
			}
		}

		delete this.translations;
		return this;
	}
}
