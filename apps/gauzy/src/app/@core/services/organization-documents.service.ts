import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	OrganizationDocument,
	OrganizationDocumentFindInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDocumentsService {
	constructor(private http: HttpClient) {}

	create(
		newDocument: OrganizationDocument
	): Observable<OrganizationDocument> {
		return this.http.post<OrganizationDocument>(
			'/api/organization-documents',
			newDocument
		);
	}

	getAll(
		findInput: OrganizationDocumentFindInput
	): Observable<{ items: OrganizationDocument[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http.get<{ items: OrganizationDocument[]; total: number }>(
			'/api/organization-documents',
			{ params: { data } }
		);
	}

	update(id: string, updateInput: OrganizationDocument) {
		return this.http.put<OrganizationDocument>(
			`/api/organization-documents/${id}`,
			updateInput
		);
	}

	delete(id: string): Observable<OrganizationDocument> {
		return this.http.delete<OrganizationDocument>(
			`/api/organization-documents/${id}`
		);
	}
}
