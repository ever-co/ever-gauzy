import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UserOrganizationService } from '@gauzy/desktop-ui-lib';
import { IUserOrganization } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class AppService {
	constructor(private http: HttpClient, private readonly _userOrganizationService: UserOrganizationService) {}

	public pingServer({ host }) {
		return firstValueFrom(this.http.get(host + '/api'));
	}

	public async getUserDetail(): Promise<IUserOrganization> {
		return await this._userOrganizationService.detail();
	}
}
