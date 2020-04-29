import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User, UserFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class UsersService {
	constructor(private http: HttpClient) {}

	API_URL = '/api/user';

	getMe(relations?: string[]): Promise<User> {
		const data = JSON.stringify({ relations });

		return this.http
			.get<User>(`${this.API_URL}/me`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getUserByEmail(emailId: string): Promise<User> {
		return this.http
			.get<User>(`${this.API_URL}/email/${emailId}`)
			.pipe(first())
			.toPromise();
	}

	getUserById(id: string): Promise<User> {
		return this.http
			.get<User>(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: UserFindInput
	): Promise<{ items: User[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: User[]; total: number }>(`${this.API_URL}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(userId: string, updateInput: UserFindInput) {
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
}
