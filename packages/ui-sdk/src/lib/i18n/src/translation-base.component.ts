import { TranslateService } from '@ngx-translate/core';

/**
 * Extends this class to use the getTranslation method
 */
export abstract class TranslationBaseComponent {
	constructor(protected readonly translateService: TranslateService) {}

	/**
	 * Get translation for the given prefix.
	 * @param prefix The translation key prefix.
	 * @param params (Optional) Parameters to be interpolated into the translation.
	 *
	 * @returns An observable that emits the translated string.
	 */
	getTranslation(prefix: string, params?: Object): string {
		let result = '';

		this.translateService.get(prefix, params).subscribe((res) => {
			result = res;
		});

		return result;
	}
}
