import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateDocumentCreateInput,
	ICandidateDocument,
	ICandidateDocumentFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateDocumentsService {
	constructor(private http: HttpClient) { }

	create(
		createInput: ICandidateDocumentCreateInput
	): Promise<ICandidateDocument> {
		return firstValueFrom(
			this.http
				.post<ICandidateDocument>(
					`${API_PREFIX}/candidate-documents`,
					createInput
				)
		);
	}

	getAll(
		findInput?: ICandidateDocumentFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
				.get<{ items: ICandidateDocument[]; total: number }>(
					`${API_PREFIX}/candidate-documents`,
					{
						params: { data }
					}
				)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-documents/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-documents/${id}`)
		);
	}
}
