import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IAccessTokenSecretPair,
	IAccessTokenDto,
	IAccessToken
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class UpworkService {
	constructor(private http: HttpClient) {}

	uploadTransaction(formData: FormData): Observable<any> {
		return this.http.post(
			'/api/integrations/upwork/transactions',
			formData
		);
	}

	getAccessTokenSecretPair(config): Observable<IAccessTokenSecretPair> {
		return this.http.post<IAccessTokenSecretPair>(
			'/api/integrations/upwork/token-secret-pair',
			config
		);
	}

	getAccessToken(accessTokenDto: IAccessTokenDto): Observable<IAccessToken> {
		return this.http.post<IAccessToken>(
			'/api/integrations/upwork/access-token',
			accessTokenDto
		);
	}
}
