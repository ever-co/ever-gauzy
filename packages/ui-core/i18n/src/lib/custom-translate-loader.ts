import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Custom loader for the translation files.
 */
export class CustomTranslateLoader implements TranslateLoader {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Get translation from the server.
	 * @param lang - The language code.
	 * @returns An Observable that resolves to the translation object.
	 */
	getTranslation(lang: string): Observable<any> {
		return this.http.get(`./assets/i18n/${lang}.json`);
	}
}
