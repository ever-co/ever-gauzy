import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Language } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class LanguagesService {
	constructor(private http: HttpClient) {}

	insertLanguage(createLanguage: Language): Promise<Language> {
		return this.http
			.post<Language>('/api/languages', createLanguage)
			.pipe(first())
			.toPromise();
	}

	getAllLanguages(): Promise<{ items: Language[] }> {
		return this.http
			.get<{ items: Language[] }>(`/api/languages`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/languages/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: Language) {
		return this.http
			.put(`/api/languages/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: Language }> {
		return this.http
			.get<{ item: Language }>(`/api/languages/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}
}
