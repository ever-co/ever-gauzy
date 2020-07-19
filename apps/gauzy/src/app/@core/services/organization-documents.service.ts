import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrganizationDocument } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDocumentsService {
	constructor(private http: HttpClient) {}

	create(newDocument: OrganizationDocument): Observable<any> {
		return this.http.post('url', newDocument);
	}

	delete(id: string): Observable<any> {
		return this.http.delete(`url/${id}`);
	}
}
