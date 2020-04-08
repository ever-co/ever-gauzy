import { Injectable, HttpService, BadRequestException } from '@nestjs/common';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	ICreateIntegrationDto,
	IIntegration,
	IntegrationEnum
} from '@gauzy/models';
import { IntegrationService } from '../integration/integration.service';

@Injectable()
export class HubstaffService {
	constructor(
		private _httpService: HttpService,
		private _integrationService: IntegrationService
	) {}

	async addIntegration(body: ICreateIntegrationDto): Promise<IIntegration> {
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded'
		};
		const { client_id, client_secret, tenantId, code, redirect_uri } = body;
		const urlParams = new URLSearchParams();

		urlParams.append('client_id', client_id);
		urlParams.append('code', code);
		urlParams.append('grant_type', 'authorization_code');
		urlParams.append('redirect_uri', redirect_uri);
		urlParams.append('client_secret', client_secret);

		return this._httpService
			.post('https://account.hubstaff.com/access_tokens', urlParams, {
				headers
			})
			.pipe(
				switchMap(({ data }) =>
					this._integrationService.addIntegration({
						tenantId,
						name: IntegrationEnum.HUBSTAFF,
						settings: [
							{
								settingsName: 'client_id',
								settingsValue: client_id
							},
							{
								settingsName: 'client_secret',
								settingsValue: client_secret
							},
							{
								settingsName: 'access_token',
								settingsValue: data.access_token
							},
							{
								settingsName: 'refresh_token',
								settingsValue: data.refresh_token
							}
						]
					})
				),
				catchError((err) => {
					throw new BadRequestException(err);
				})
			)
			.toPromise();
	}

	getOrganizations({ token }): Observable<any> {
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
