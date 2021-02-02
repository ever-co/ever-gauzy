import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ILanguage } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class LanguagesService {
	constructor(private http: HttpClient) {}

	insertLanguage(createLanguage: ILanguage): Promise<ILanguage> {
		return this.http
			.post<ILanguage>(`${API_PREFIX}/languages`, createLanguage)
			.pipe(first())
			.toPromise();
	}

	getAllLanguages(): Promise<{ items: ILanguage[] }> {
		return this.http
			.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`)
			.pipe(first())
			.toPromise();
	}

	getSystemLanguages(): Promise<{ items: ILanguage[] }> {
		const option = JSON.stringify({ is_system: true });
		return this.http
			.get<{ items: ILanguage[] }>(`${API_PREFIX}/languages`, {
				params: { option }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/languages/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: ILanguage) {
		return this.http
			.put(`${API_PREFIX}/languages/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	findByName(name: string): Promise<{ item: ILanguage }> {
		return this.http
			.get<{ item: ILanguage }>(
				`${API_PREFIX}/languages/getByName/${name}`
			)
			.pipe(first())
			.toPromise();
	}
}
