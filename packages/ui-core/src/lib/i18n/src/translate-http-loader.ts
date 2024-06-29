import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

/**
 * Factory function to create an instance of TranslateHttpLoader
 * for loading translation files using HttpClient.
 * @param http An instance of HttpClient service.
 * @returns An instance of TranslateHttpLoader configured to load translation files from './assets/i18n/' with a '.json' extension.
 */
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
