import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IOrganizationDocument,
	IOrganizationDocumentFindInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDocumentsService {
	constructor(private http: HttpClient) {}

	create(
		newDocument: IOrganizationDocument
	): Observable<IOrganizationDocument> {
		return this.http.post<IOrganizationDocument>(
			'/api/organization-documents',
			newDocument
		);
	}

	getAll(
		findInput: IOrganizationDocumentFindInput
	): Observable<{ items: IOrganizationDocument[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http.get<{ items: IOrganizationDocument[]; total: number }>(
			'/api/organization-documents',
			{ params: { data } }
		);
	}

	update(id: string, updateInput: IOrganizationDocument) {
		return this.http.put<IOrganizationDocument>(
			`/api/organization-documents/${id}`,
			updateInput
		);
	}

	delete(id: string): Observable<IOrganizationDocument> {
		return this.http.delete<IOrganizationDocument>(
			`/api/organization-documents/${id}`
		);
	}
}
