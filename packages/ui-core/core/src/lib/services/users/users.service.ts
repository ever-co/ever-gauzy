import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IUser, IUserUpdateInput } from '@gauzy/contracts';
import { API_PREFIX, buildHttpParams } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class UsersService {
	private http = inject(HttpClient);

	/**
	 * Retrieves the current user's details, optionally including specified relations and employee data.
	 *
	 * @param relations - An array of relation names to include in the response.
	 * @param includeEmployee - Whether to include employee details.
	 * @returns A promise that resolves to the IUser object.
	 */
	async getMe(relations: string[] = [], includeEmployee: boolean = false): Promise<IUser> {
		const params = buildHttpParams({ relations, includeEmployee });
		return firstValueFrom(this.http.get<IUser>(`${API_PREFIX}/user/me`, { params }));
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
		return await firstValueFrom(this.http.put(`${API_PREFIX}/user/${id}`, input));
	}

	/**
	 * Deletes a user by their ID.
	 *
	 * @param id - The unique identifier of the user to delete.
	 * @param user - Additional user data or options (if required by the API) to be passed in the request.
	 * @returns A Promise that resolves with the server's response after deleting the user.
	 */
	async delete(id: ID, user: any): Promise<any> {
		return await firstValueFrom(this.http.delete(`${API_PREFIX}/user/${id}`, { body: user }));
	}

	/**
	 * Deletes all user-related data from the system.
	 *
	 * @returns A Promise that resolves once all user data has been successfully deleted.
	 */
	async deleteAllData(): Promise<any> {
		return await firstValueFrom(this.http.delete(`${API_PREFIX}/user/reset`));
	}

	/**
	 * Updates the user's preferred language setting.
	 *
	 * @param input - An object containing the user update information, including the new preferred language.
	 * @returns A Promise that resolves once the preferred language has been successfully updated.
	 */
	async updatePreferredLanguage(input: IUserUpdateInput): Promise<any> {
		return await firstValueFrom(this.http.put(`${API_PREFIX}/user/preferred-language`, input));
	}

	/**
	 * Updates the user's preferred component layout setting.
	 *
	 * @param input - An object containing the user update information, including the new preferred layout preference.
	 * @returns A Promise that resolves once the preferred layout has been successfully updated.
	 */
	async updatePreferredComponentLayout(input: IUserUpdateInput): Promise<any> {
		return await firstValueFrom(this.http.put(`${API_PREFIX}/user/preferred-layout`, input));
	}
}
