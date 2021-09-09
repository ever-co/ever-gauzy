import { TranslateService } from '@ngx-translate/core';

/**
 * Extends this class to use the getTranslation method
 */
export abstract class TranslationBaseComponent {
	constructor(
		public readonly translateService: TranslateService
	) {}

	getTranslation(prefix: string, params?: Object) {
		let result = '';
		this.translateService.get(prefix, params).subscribe((res) => {
			result = res;
		});

		return result;
	}
}
