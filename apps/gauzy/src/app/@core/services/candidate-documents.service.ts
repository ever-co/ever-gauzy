import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
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
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateDocumentCreateInput
	): Promise<ICandidateDocument> {
		return this.http
			.post<ICandidateDocument>(
				`${API_PREFIX}/candidate-documents`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateDocumentFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateDocument[]; total: number }>(
				`${API_PREFIX}/candidate-documents`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-documents/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-documents/${id}`)
			.pipe(first())
			.toPromise();
	}
}
