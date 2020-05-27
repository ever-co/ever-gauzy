import { Base } from './base';
import {
	Translation as ITranslation,
	Translatable as ITranslatable,
} from '@gauzy/models';

export abstract class TranslationBase<T> extends Base
	implements ITranslation<T> {
	reference?: ITranslatable<T>;
	languageCode: string;
}

export abstract class TranslatableBase<T> extends Base
	implements ITranslatable<T> {
	translations: ITranslation<T>[];

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
