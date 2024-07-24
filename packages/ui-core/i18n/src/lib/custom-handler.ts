import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

/**
 * Custom handler for missing translations.
 */
export class CustomHandler implements MissingTranslationHandler {
	/**
	 * Handles missing translations.
	 *
	 * @param params The parameters containing information about the missing translation.
	 * @returns The fallback translation or a default message indicating the translation is missing.
	 */
	handle(params: MissingTranslationHandlerParams): string {
		console.log('Missing translation for:', params.key, 'in language:', params);
		// Implement your custom missing translation handling logic here.
		// For example, you might want to return a default message indicating the translation is missing.
		return params.key;
	}
}
