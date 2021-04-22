import { ITranslation, ITranslatable } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../entities/internal';

export abstract class TranslationBase
	extends TenantOrganizationBaseEntity
	implements ITranslation<TranslatableBase> {
	reference: ITranslatable<TranslatableBase>;
	languageCode: string;
}

export interface TranslateInput {
	key: string;
	alias: string;
}

export interface TranslatePropertyInput {
	prop: string;
	propsTranslate: Array<TranslateInput>;
	propAsArr?: Array<string>;
}

export abstract class TranslatableBase
	extends TenantOrganizationBaseEntity
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

	/*
	 * translate product object keeping all root elements
	 * and adding translated prop up to two nested levels
	 */
	translateNested(
		languageCode: string,
		translatePropsInput: Array<TranslatePropertyInput>
	): any {
		let element: TranslatableBase = this;
		let currentInputProp: TranslatePropertyInput;
		let propsTranslateKeys: TranslateInput[];
		let elementPropTranslations: ITranslation<TranslationBase>[];

		let result: any = {};

		let inputProps: Array<TranslatePropertyInput> = translatePropsInput.map(
			(translateObj: TranslatePropertyInput) => {
				return {
					...translateObj,
					propAsArr: translateObj.prop.split('.')
				};
			}
		);

		Object.keys(this).forEach((prop: string) => {
			if (prop == 'translations') prop = 'root';

			currentInputProp = inputProps.find(
				(el: TranslatePropertyInput) => el.propAsArr[0] == prop
			);

			if (!currentInputProp) {
				result[prop] = element[prop];
			} else {
				let inputKeys = inputProps.find(
					(el: TranslatePropertyInput) => el.propAsArr[0] == prop
				).propAsArr;

				if (prop == 'root') {
					elementPropTranslations = element
						? element.translations
						: [];
				} else if (inputKeys.length == 1) {
					elementPropTranslations = element[inputKeys[0]]
						? element[inputKeys[0]].translations
						: [];
				} else if (inputKeys.length == 2) {
					elementPropTranslations = element[inputKeys[0]]
						? element[inputKeys[0]][inputKeys[1]].translations
						: [];
				}

				let elementPropTranslation =
					elementPropTranslations.find(
						(translation: ITranslation<TranslationBase>) =>
							translation.languageCode == languageCode
					) || null;

				if (elementPropTranslations && elementPropTranslation) {
					propsTranslateKeys = currentInputProp.propsTranslate || [];

					propsTranslateKeys.forEach((translateKeyInput) => {
						result[translateKeyInput.alias] =
							elementPropTranslation[translateKeyInput.key] || '';
					});
				}
			}
		});

		return result;
	}
}
