import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateDocumentCreateInput,
	ICandidateDocument,
	ICandidateDocumentFindInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class CandidateDocumentsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateDocumentCreateInput
	): Promise<ICandidateDocument> {
		return this.http
			.post<ICandidateDocument>('/api/candidate-documents', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateDocumentFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateDocument[]; total: number }>(
				`/api/candidate-documents`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-documents/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-documents/${id}`)
			.pipe(first())
			.toPromise();
	}
}
