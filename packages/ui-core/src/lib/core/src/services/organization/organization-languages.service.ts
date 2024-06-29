import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationLanguageCreateInput,
	IOrganizationLanguage,
	IOrganizationLanguageFindInput
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationLanguagesService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationLanguageCreateInput): Promise<IOrganizationLanguage> {
		return firstValueFrom(
			this.http.post<IOrganizationLanguage>(`${API_PREFIX}/organization-languages`, createInput)
		);
	}

	getAll(
		findInput?: IOrganizationLanguageFindInput,
		relations?: string[]
	): Promise<{ items: IOrganizationLanguage[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{ items: IOrganizationLanguage[]; total: number }>(`${API_PREFIX}/organization-languages`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-languages/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/organization-languages/${id}`));
	}
}
