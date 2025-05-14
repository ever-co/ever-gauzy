import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, ILanguage } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class LanguagesService {
	constructor(private http: HttpClient) {}

	insertLanguage(createLanguage: ILanguage): Promise<ILanguage> {
		return firstValueFrom(this.http.post<ILanguage>(`${API_PREFIX}/languages`, createLanguage));
	}

	getAllLanguages(): Promise<{ items: ILanguage[] }> {
		return firstValueFrom(this.http.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`));
	}

	getSystemLanguages(): Promise<{ items: ILanguage[] }> {
		return firstValueFrom(
			this.http.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`, {
				params: toParams({ is_system: 1 })
			})
		);
	}

	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/languages/${id}`));
	}

	update(id: ID, updateInput: ILanguage) {
		return firstValueFrom(this.http.put(`${API_PREFIX}/languages/${id}`, updateInput));
	}

	findByName(name: string): Promise<{ item: ILanguage }> {
		return firstValueFrom(this.http.get<{ item: ILanguage }>(`${API_PREFIX}/languages/getByName/${name}`));
	}
}
