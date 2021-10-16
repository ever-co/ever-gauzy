import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IUser, IUserFindInput, IUserUpdateInput } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class UsersService {
	constructor(private http: HttpClient) { }

	API_URL = `${API_PREFIX}/user`;

	getMe(relations?: string[]): Promise<IUser> {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http
			.get<IUser>(`${this.API_URL}/me`, {
				params: { data }
			})
		);
	}

	getUserByEmail(emailId: string): Promise<IUser> {
		return firstValueFrom(
			this.http
			.get<IUser>(`${this.API_URL}/email/${emailId}`)
		);
	}

	getUserById(id: string, relations?: string[]): Promise<IUser> {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http
			.get<IUser>(`${this.API_URL}/${id}`, {
				params: { data }
			})
		);
	}

	getAll(
		relations?: string[],
		findInput?: IUserFindInput
	): Promise<{ items: IUser[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: IUser[]; total: number }>(`${this.API_URL}`, {
				params: { data }
			})
		);
	}

	update(userId: string, updateInput: IUserUpdateInput) {
		return firstValueFrom(
			this.http
			.put(`${this.API_URL}/${userId}`, updateInput)
		);
	}

	delete(userId, user) {
		return firstValueFrom(
			this.http
			.delete(`${this.API_URL}/${userId}`, user)
		);
	}

	deleteAllData(userId) {
		return firstValueFrom(
			this.http
			.delete(`${this.API_URL}/reset/${userId}`)
		);
	}

	updatePreferredLanguage(
		userId: string,
		updateInput: IUserUpdateInput
	) {
		return firstValueFrom(
			this.http
			.put(`${this.API_URL}/preferred-language/${userId}`, updateInput)
		);
	}

	updatePreferredComponentLayout(
		userId: string,
		updateInput: IUserUpdateInput
	) {
		return firstValueFrom(
			this.http
			.put(`${this.API_URL}/preferred-layout/${userId}`, updateInput)
		);
	}
}
