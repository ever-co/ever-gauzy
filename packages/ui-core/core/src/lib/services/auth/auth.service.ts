import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
	IUser,
	RolesEnum,
	IUserRegistrationInput,
	PermissionsEnum,
	IAuthResponse,
	IUserEmailInput,
	IUserTokenInput,
	IUserSigninWorkspaceResponse,
	IUserLoginInput,
	IUserCodeInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class AuthService {
	constructor(private readonly http: HttpClient) {}

	isAuthenticated(): Promise<boolean> {
		return firstValueFrom(this.http.get<boolean>(`${API_PREFIX}/auth/authenticated`));
	}

	confirmEmail(body: IUserEmailInput & IUserTokenInput): Observable<Object> {
		return this.http.post<Object>(`${API_PREFIX}/auth/email/verify`, body);
	}

	login(loginInput: IUserLoginInput): Observable<IAuthResponse> {
		return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/login`, loginInput);
	}

	/**
	 * Sign in to workspaces with the provided input.
	 *
	 * @param input - The input containing user login information.
	 * @returns An observable of the response for signing in to workspaces.
	 */
	findWorkspaces(input: IUserLoginInput): Observable<IUserSigninWorkspaceResponse> {
		try {
			// Send a POST request to the server endpoint with the provided input
			return this.http.post<IUserSigninWorkspaceResponse>(`${API_PREFIX}/auth/signin.email.password`, input);
		} catch (error) {
			console.log('Error while signing in workspaces: %s', error?.message);
			// Handle errors appropriately (e.g., log, throw, etc.)
			throw error;
		}
	}

	/**
	 *
	 */
	sendSigninCode(input: IUserEmailInput) {
		try {
			// Send a POST request to the server endpoint with the provided input
			return this.http.post<IUserEmailInput>(`${API_PREFIX}/auth/signin.email`, input);
		} catch (error) {
			console.log('Error while sending magic code: %s', error?.message);
			// Handle errors appropriately (e.g., log, throw, etc.)
			throw error;
		}
	}

	/**
	 *
	 */
	confirmSignInByCode(input: IUserEmailInput & IUserCodeInput) {
		try {
			// Send a POST request to the server endpoint with the provided input
			return this.http.post<IUserSigninWorkspaceResponse>(`${API_PREFIX}/auth/signin.email/confirm`, input);
		} catch (error) {
			console.log('Error while confirm signin by email & magic code: %s', error?.message);
			// Handle errors appropriately (e.g., log, throw, etc.)
			throw error;
		}
	}

	/**
	 * Sign in to a specific tenant workspace using the provided input.
	 *
	 * @param input - The input containing user email and token.
	 * @returns An observable of the response for signing in to the specific tenant workspace.
	 */
	signinWorkspaceByToken(input: IUserEmailInput & IUserTokenInput) {
		try {
			// Send a POST request to the server endpoint with the provided input
			return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/signin.workspace`, input);
		} catch (error) {
			console.log('Error while signing in specific tenant workspace: %s', error?.message);
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

	register(input: IUserRegistrationInput): Observable<IUser> {
		return this.http.post<IUser>(`${API_PREFIX}/auth/register`, input);
	}

	requestPassword(requestPasswordInput): Observable<{ id?: string; token?: string }> {
		return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/request-password`, requestPasswordInput);
	}

	resetPassword(resetPasswordInput) {
		return this.http.post(`${API_PREFIX}/auth/reset-password`, resetPasswordInput);
	}

	/**
	 * Checks if the current user has the specified roles.
	 *
	 * @param {RolesEnum[]} roles - An array of roles to check.
	 * @return {Observable<boolean>} An observable that emits a boolean indicating whether the user has the specified roles.
	 */
	hasRole(roles: RolesEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/role`, {
			params: toParams({ roles })
		});
	}

	/**
	 * Checks if the user has the specified permissions.
	 *
	 * @param {...PermissionsEnum[]} permissions - The permissions to check.
	 * @return {Observable<boolean>} An observable that emits a boolean indicating whether the user has the specified permissions.
	 */
	hasPermissions(...permissions: PermissionsEnum[]): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/permissions`, {
			params: toParams({ permissions })
		});
	}

	/**
	 * GET access token from refresh token
	 *
	 * @param refresh_token
	 * @returns
	 */
	refreshToken(refresh_token: string): Promise<{ token: string } | null> {
		return firstValueFrom(this.http.post<any>(`${API_PREFIX}/auth/refresh-token`, { refresh_token }));
	}

	/**
	 * Get all workspaces (tenants) that the current authenticated user has access to.
	 *
	 * @param includeTeams - Whether to include teams in the response (default: false).
	 * @returns An observable of the user signin workspace response.
	 */
getUserWorkspaces(includeTeams = false): Observable<IUserSigninWorkspaceResponse> {
    return this.http.get<IUserSigninWorkspaceResponse>(`${API_PREFIX}/auth/workspaces`, {
        params: toParams({ includeTeams })
    });
}

	/**
	 * Switch the current user to a different workspace (tenant).
	 *
	 * @param tenantId - The ID of the tenant to switch to.
	 * @returns An observable of the authentication response with new tokens or null if switching fails.
	 */
	switchWorkspace(tenantId: string): Observable<IAuthResponse | null> {
		return this.http.post<IAuthResponse | null>(`${API_PREFIX}/auth/switch-workspace`, { tenantId });
	}
}
