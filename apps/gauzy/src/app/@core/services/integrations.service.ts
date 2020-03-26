import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class IntegrationsService {
	constructor(private http: HttpClient) {}

	uploadUpworkTransaction(formData: FormData): Observable<any> {
		return this.http.post(
			'/api/integrations/upwork-transactions',
			formData
		);
	}
}
