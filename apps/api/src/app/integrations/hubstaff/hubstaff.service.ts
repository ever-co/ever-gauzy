import { Injectable, HttpService, BadRequestException } from '@nestjs/common';
import { map, catchError } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	IHubstaffGetAccessTokensDto,
	IHubstaffAccessTokens
} from '@gauzy/models';

@Injectable()
export class HubstaffService {
	constructor(private _httpService: HttpService) {}

	getAccessTokens(
		body: IHubstaffGetAccessTokensDto
	): Observable<IHubstaffAccessTokens> {
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};

		const urlParams = new URLSearchParams();
		urlParams.append('client_id', body.client_id);
		urlParams.append('code', body.code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', body.redirect_uri);
		urlParams.append('client_secret', body.client_secret);

		return this._httpService
			.post('https://account.hubstaff.com/access_tokens', urlParams, {
				headers
			})
			.pipe(
				map((response) => response.data),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			);
	}

	getOrganizations(token): Observable<any> {
		const headers = {
			Authorization: `Bearer ${token}`
		};

		return this._httpService
			.get('https://api.hubstaff.com/v2/organizations', { headers })
			.pipe(
				map((response) => response.data),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			);
	}
}
