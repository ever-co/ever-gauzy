import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IUser, IUserFindInput, IUserUpdateInput } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class UsersService {
	constructor(private http: HttpClient) { }

	API_URL = `${API_PREFIX}/user`;

	getMe(relations?: string[]): Promise<IUser> {
		const data = JSON.stringify({ relations });

		return this.http
			.get<IUser>(`${this.API_URL}/me`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getUserByEmail(emailId: string): Promise<IUser> {
		return this.http
			.get<IUser>(`${this.API_URL}/email/${emailId}`)
			.pipe(first())
			.toPromise();
	}

	getUserById(id: string, relations?: string[]): Promise<IUser> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<IUser>(`${this.API_URL}/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IUserFindInput
	): Promise<{ items: IUser[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IUser[]; total: number }>(`${this.API_URL}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(userId: string, updateInput: IUserUpdateInput) {
		return this.http
			.put(`${this.API_URL}/${userId}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(userId, user) {
		return this.http
			.delete(`${this.API_URL}/${userId}`, user)
			.pipe(first())
			.toPromise();
	}

	deleteAllData(userId) {
		return this.http
			.delete(`${this.API_URL}/all-data/${userId}`)
			.pipe(first())
			.toPromise();
	}

	updatePreferredLanguage(
		userId: string,
		updateInput: IUserUpdateInput
	) {
		return this.http
			.put(`${this.API_URL}/preferred-language/${userId}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updatePreferredComponentLayout(
		userId: string,
		updateInput: IUserUpdateInput
	) {
		return this.http
			.put(`${this.API_URL}/preferred-layout/${userId}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
