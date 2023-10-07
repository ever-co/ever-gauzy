import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IUser,
	RolesEnum,
	IUserRegistrationInput,
	PermissionsEnum,
	IAuthResponse,
	IUserEmailInput,
	IUserTokenInput,
	IUserSigninWorkspaceResponse,
	IUserLoginInput
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class AuthService {
	constructor(private readonly http: HttpClient) {}

	isAuthenticated(): Promise<boolean> {
		return firstValueFrom(
			this.http.get<boolean>(`${API_PREFIX}/auth/authenticated`)
		);
	}

	confirmEmail(body: IUserEmailInput & IUserTokenInput): Observable<Object> {
		return this.http.post<Object>(`${API_PREFIX}/auth/email/verify`, body);
	}

	login(loginInput: IUserLoginInput): Observable<IAuthResponse> {
		return this.http.post<IAuthResponse>(
			`${API_PREFIX}/auth/login`,
			loginInput
		);
	}

	/**
	 * Sign in to a different workspace.
	 * @param input - IUserLoginInput containing email and password.
	 * @returns Promise<IUserSigninWorkspaceResponse> representing the response from the server.
	 */
	signinWorkspaces(
		input: IUserLoginInput
	): Observable<IUserSigninWorkspaceResponse> {
		try {
			return this.http.post<IUserSigninWorkspaceResponse>(
				`${API_PREFIX}/auth/signin.workspaces`,
				input
			);
		} catch (error) {
			console.log('Error while signin workspaces: %s', error?.message);
			// Handle errors appropriately (e.g., log, throw, etc.)
			throw error;
		}
	}

	/**
	 * Logout API Route
	 *
	 * @returns
	 */
	doLogout(): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/logout`);
	}

	register(registerInput: IUserRegistrationInput): Observable<IUser> {
		return this.http.post<IUser>(
			`${API_PREFIX}/auth/register`,
			registerInput
		);
	}

	requestPassword(
		requestPasswordInput
	): Observable<{ id?: string; token?: string }> {
		return this.http.post<IAuthResponse>(
			`${API_PREFIX}/auth/request-password`,
			requestPasswordInput
		);
	}

	resetPassword(resetPasswordInput) {
		return this.http.post(
			`${API_PREFIX}/auth/reset-password`,
			resetPasswordInput
		);
	}

	hasRole(roles: RolesEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/role`, {
			params: toParams({ roles }),
		});
	}

	hasPermissions(...permissions: PermissionsEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/permissions`, {
			params: toParams({ permissions }),
		});
	}

	/**
	 * GET access token from refresh token
	 *
	 * @param refresh_token
	 * @returns
	 */
	refreshToken(refresh_token: string): Promise<any> {
		return firstValueFrom(
			this.http.post<any>(`${API_PREFIX}/auth/refresh-token`, {
				refresh_token: refresh_token,
			})
		);
	}
}
