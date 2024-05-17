import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateDocumentCreateInput,
	ICandidateDocument,
	ICandidateDocumentFindInput,
	IPagination
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateDocumentsService {
	constructor(private readonly http: HttpClient) {}

	create(createInput: ICandidateDocumentCreateInput): Promise<ICandidateDocument> {
		return firstValueFrom(this.http.post<ICandidateDocument>(`${API_PREFIX}/candidate-documents`, createInput));
	}

	getAll(where: ICandidateDocumentFindInput): Promise<IPagination<ICandidateDocument>> {
		return firstValueFrom(
			this.http.get<IPagination<ICandidateDocument>>(`${API_PREFIX}/candidate-documents`, {
				params: toParams({ where })
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-documents/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-documents/${id}`));
	}
}
