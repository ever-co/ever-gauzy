import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ILanguage } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';
import { LanguageCacheService } from '../services';

@Injectable({
	providedIn: 'root'
})
export class LanguageService {
	constructor(private _http: HttpClient, private _languageCacheService: LanguageCacheService) {}

	public all(): Promise<{ items: ILanguage[] }> {
		const KEY = 'all';
		let languages$ = this._languageCacheService.getValue(KEY);
		if (!languages$) {
			languages$ = this._http.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`).pipe(
				map((response: { items: ILanguage[] }) => response),
				shareReplay(1)
			);
			this._languageCacheService.setValue(languages$, KEY);
		}
		return firstValueFrom(languages$);
	}

	public system(): Promise<{ items: ILanguage[] }> {
		const params = toParams({ is_system: 1 });
		let languages$ = this._languageCacheService.getValue(params);
		if (!languages$) {
			languages$ = this._http
				.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`, {
					params
				})
				.pipe(
					map((response: { items: ILanguage[] }) => response),
					shareReplay(1)
				);
			this._languageCacheService.setValue(languages$, params);
		}
		return firstValueFrom(languages$);
	}
}
