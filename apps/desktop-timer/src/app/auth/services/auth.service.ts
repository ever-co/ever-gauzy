import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { IUser, RolesEnum, IUserRegistrationInput, PermissionsEnum, IAuthResponse } from '@gauzy/contracts';
import { Observable, firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class AuthService {
	constructor(private http: HttpClient) {}

	isAuthenticated(): Promise<boolean> {
		return firstValueFrom(this.http.get<boolean>(`${API_PREFIX}/auth/authenticated`).pipe(first()));
	}

	login(loginInput): Observable<IAuthResponse> {
		return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/login`, loginInput);
	}

	register(registerInput: IUserRegistrationInput): Observable<IUser> {
		return this.http.post<IUser>(`${API_PREFIX}/auth/register`, registerInput);
	}

	requestPassword(requestPasswordInput): Observable<{ token: string }> {
		return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/request-password`, requestPasswordInput);
	}

	resetPassword(resetPasswordInput) {
		return this.http.post(`${API_PREFIX}/auth/reset-password`, resetPasswordInput);
	}

	hasRole(roles: RolesEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/role`, {
			params: { roles }
		});
	}

	hasPermission(permission: PermissionsEnum): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/permission`, {
			params: { permission }
		});
	}
}
