import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UserOrganizationService } from '@gauzy/desktop-ui-lib';
import { IUser } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class AppService {
	constructor(
		private readonly http: HttpClient,
		private readonly _userOrganizationService: UserOrganizationService
	) { }

	/**
	 * Sends a GET request to the given host to check if the server is reachable.
	 *
	 * @param param0 - An object containing the host URL.
	 * @param param0.host - The base URL of the server to ping.
	 * @returns A promise that resolves with the server's response.
	 *
	 * @example
	 * const response = await pingServer({ host: 'https://example.com' });
	 */
	public pingServer({ host }: { host: string }): Promise<any> {
		return firstValueFrom(this.http.get(`${host}/api`));
	}

	/**
	 * Retrieves detailed information about the current user.
	 *
	 * This function fetches user details from the `_userOrganizationService`.
	 * It returns a promise that resolves to an `IUser` object containing user details.
	 *
	 * @returns A promise resolving to the user details (`IUser`).
	 */
	public async getUserDetail(): Promise<IUser> {
		return await this._userOrganizationService.detail();
	}
}
