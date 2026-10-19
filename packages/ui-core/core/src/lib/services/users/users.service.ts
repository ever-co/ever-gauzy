import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IUser, IUserUiPreferences, IUserUiPreferencesUpdateInput, IUserUpdateInput } from '@gauzy/contracts';
import { API_PREFIX, buildHttpParams } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';
import { cloneJson, RecentAnswers } from '../recent-answers';

/**
 * How long an answer of `GET /user/me` is reused for an identical request (same user, token, relations and
 * includeEmployee). The app loads the signed-in user from several places as it starts (`AppInitService`, the pages
 * entry point, route resolvers), each a full round trip for the same rows; a profile change through this service
 * forgets the answer at once, and {@link UsersService.forgetMe} is there for any other writer.
 */
export const ME_REUSE_WINDOW_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class UsersService {
	private http = inject(HttpClient);
	private store = inject(Store);
	private readonly recentMe = new RecentAnswers<IUser>(ME_REUSE_WINDOW_MS);

	/**
	 * Retrieves the current user's details, optionally including specified relations and employee data.
	 *
	 * An identical request made within {@link ME_REUSE_WINDOW_MS} of the previous one is answered from that one;
	 * every caller receives its own copy.
	 *
	 * @param relations - An array of relation names to include in the response.
	 * @param includeEmployee - Whether to include employee details.
	 * @returns A promise that resolves to the IUser object.
	 */
	async getMe(relations: string[] = [], includeEmployee: boolean = false): Promise<IUser> {
		const key = [
			this.store.userId ?? '',
			this.store.token ?? '',
			[...relations].sort().join(','),
			includeEmployee
		].join('|');
		return (
			this.recentMe
				.get(key, () => {
					const params = buildHttpParams({ relations, includeEmployee });
					return firstValueFrom(this.http.get<IUser>(`${API_PREFIX}/user/me`, { params }));
				})
				// Each caller gets its own copy: the cached answer is shared, what a caller does to it must not be.
				.then(cloneJson)
		);
	}

	/**
	 * Forgets the recent answers of {@link getMe}: the next call asks the API again. Called by every write of
	 * this service; call it after changing the signed-in user through another service (an employee update
	 * that `includeEmployee` would return, for example).
	 */
	forgetMe(): void {
		this.recentMe.forget();
	}

	/**
	 * Runs a write of the signed-in user with the recent answers of {@link getMe} forgotten before it starts
	 * and again once it has settled: a read that overlapped the write and remembered the old row must not
	 * outlive the write.
	 */
	private async write<R>(request: () => Promise<R>): Promise<R> {
		this.forgetMe();
		try {
			return await request();
		} finally {
			this.forgetMe();
		}
	}

	/**
	 * Retrieves a user by their email address.
	 *
	 * @param emailId - The email address of the user to retrieve.
	 * @returns A Promise that resolves with the user information.
	 */
	async getUserByEmail(emailId: string): Promise<IUser> {
		return await firstValueFrom(this.http.get<IUser>(`${API_PREFIX}/user/email/${emailId}`));
	}

	/**
	 * Retrieves a user by their unique ID, optionally including related entities.
	 *
	 * @param id - The unique identifier of the user to retrieve.
	 * @param relations - (Optional) An array of related entity names to include in the result.
	 * @returns A Promise that resolves with the user information.
	 */
	async getUserById(id: string, relations?: string[]): Promise<IUser> {
		const data = JSON.stringify({ relations });
		return await firstValueFrom(this.http.get<IUser>(`${API_PREFIX}/user/${id}`, { params: { data } }));
	}

	/**
	 * Updates the user information for a specific user ID.
	 *
	 * @param id - The unique identifier of the user to update.
	 * @param input - An object containing the updated user details.
	 * @returns A Promise that resolves with the server's response after updating the user.
	 */
	async update(id: ID, input: IUserUpdateInput): Promise<any> {
		return this.write(() => firstValueFrom(this.http.put(`${API_PREFIX}/user/${id}`, input)));
	}

	/**
	 * Deletes a user by their ID.
	 *
	 * @param id - The unique identifier of the user to delete.
	 * @param user - Additional user data or options (if required by the API) to be passed in the request.
	 * @returns A Promise that resolves with the server's response after deleting the user.
	 */
	async delete(id: ID, user: any): Promise<any> {
		return this.write(() => firstValueFrom(this.http.delete(`${API_PREFIX}/user/${id}`, { body: user })));
	}

	/**
	 * Deletes all user-related data from the system.
	 *
	 * @returns A Promise that resolves once all user data has been successfully deleted.
	 */
	async deleteAllData(): Promise<any> {
		return this.write(() => firstValueFrom(this.http.delete(`${API_PREFIX}/user/reset`)));
	}

	/**
	 * Updates the user's preferred language setting.
	 *
	 * @param input - An object containing the user update information, including the new preferred language.
	 * @returns A Promise that resolves once the preferred language has been successfully updated.
	 */
	async updatePreferredLanguage(input: IUserUpdateInput): Promise<any> {
		return this.write(() => firstValueFrom(this.http.put(`${API_PREFIX}/user/preferred-language`, input)));
	}

	/**
	 * Updates the user's preferred component layout setting.
	 *
	 * @param input - An object containing the user update information, including the new preferred layout preference.
	 * @returns A Promise that resolves once the preferred layout has been successfully updated.
	 */
	async updatePreferredComponentLayout(input: IUserUpdateInput): Promise<any> {
		return this.write(() => firstValueFrom(this.http.put(`${API_PREFIX}/user/preferred-layout`, input)));
	}

	/**
	 * Merges a per-feature patch into the current user's server-side UI preferences
	 * (`PUT /user/ui-preferences`, shallow merge per top-level feature key).
	 *
	 * @param patch - Feature-keyed objects to replace, e.g. `{ aiChat: { expanded: true } }`.
	 * @returns A Promise resolving to the merged preferences as now stored.
	 */
	async updateUiPreferences(patch: IUserUiPreferencesUpdateInput): Promise<IUserUiPreferences> {
		return this.write(() =>
			firstValueFrom(this.http.put<IUserUiPreferences>(`${API_PREFIX}/user/ui-preferences`, patch))
		);
	}
}
