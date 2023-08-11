import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ILanguage } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root',
})
export class LanguageService {
	constructor(private _http: HttpClient) { }

	public all(): Promise<{ items: ILanguage[] }> {
		return firstValueFrom(
			this._http.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`)
		);
	}

	public system(): Promise<{ items: ILanguage[] }> {
		return firstValueFrom(
			this._http.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`, {
				params: toParams({ is_system: 1 }),
			})
		);
	}
}
