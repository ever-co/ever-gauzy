import { ITranslation, ITranslatable } from '@gauzy/models';
import { TenantOrganizationBase } from './tenant-organization-base';

export abstract class TranslationBase
	extends TenantOrganizationBase
	implements ITranslation<TranslatableBase> {
	reference: ITranslatable<TranslatableBase>;
	languageCode: string;
}

export abstract class TranslatableBase
	extends TenantOrganizationBase
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

	translateNested(langCode: string): any {}
}
