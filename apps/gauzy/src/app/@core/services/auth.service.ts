import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IUser,
	RolesEnum,
	IUserRegistrationInput,
	PermissionsEnum,
	IAuthResponse
} from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable()
export class AuthService {
	constructor(private http: HttpClient) {}

	isAuthenticated(): Promise<boolean> {
		return this.http
			.get<boolean>('/api/auth/authenticated')
			.pipe(first())
			.toPromise();
	}

	login(loginInput): Observable<IAuthResponse> {
		return this.http.post<IAuthResponse>('/api/auth/login', loginInput);
	}

	register(registerInput: IUserRegistrationInput): Observable<IUser> {
		return this.http.post<IUser>('/api/auth/register', registerInput);
	}

	requestPassword(
		requestPasswordInput
	): Observable<{ id?: string; token?: string }> {
		return this.http.post<IAuthResponse>(
			'/api/auth/request-password',
			requestPasswordInput
		);
	}

	resetPassword(resetPasswordInput) {
		return this.http.post('/api/auth/reset-password', resetPasswordInput);
	}

	hasRole(roles: RolesEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`/api/auth/role`, { params: { roles } });
	}

	hasPermission(permission: PermissionsEnum): Observable<boolean> {
		return this.http.get<boolean>(`/api/auth/permission`, {
			params: { permission }
		});
	}
}
