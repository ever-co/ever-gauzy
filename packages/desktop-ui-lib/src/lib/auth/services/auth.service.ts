import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { GAUZY_ENV } from '../../constants';
import {
	IAuthResponse,
	IUser,
	IUserCodeInput,
	IUserEmailInput,
	IUserLoginInput,
	IUserRegistrationInput,
	IUserSigninWorkspaceResponse,
	IUserTokenInput,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { Observable, firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../../constants/app.constants';
import { ElectronService } from '../../electron/services';

@Injectable()
export class AuthService {
	constructor(
		private http: HttpClient,
		private readonly electronService: ElectronService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
	) {}

	isAuthenticated(): Promise<boolean> {
		return firstValueFrom(this.http.get<boolean>(`${API_PREFIX}/auth/authenticated`));
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

	confirmEmail(body: IUserEmailInput & IUserTokenInput) {
		return this.http.post(`${API_PREFIX}/auth/email/verify`, body);
	}

	/**
	 * Sign in to workspaces with the provided input.
	 *
	 * @param input - The input containing user login information.
	 * @returns An observable of the response for signing in to workspaces.
	 */
	findWorkspaces(input: IUserLoginInput): Observable<IUserSigninWorkspaceResponse> {
		// Send a POST request to the server endpoint with the provided input
		return this.http.post<IUserSigninWorkspaceResponse>(`${API_PREFIX}/auth/signin.email.password`, input);
	}

	/**
	 *
	 */
	sendSigninCode(input: IUserEmailInput) {
		// Send a POST request to the server endpoint with the provided input
		return this.http.post<IUserEmailInput>(`${API_PREFIX}/auth/signin.email`, input);
	}

	/**
	 *
	 */
	confirmSignInByCode(input: IUserEmailInput & IUserCodeInput) {
		// Send a POST request to the server endpoint with the provided input
		return this.http.post<IUserSigninWorkspaceResponse>(`${API_PREFIX}/auth/signin.email/confirm`, input);
	}

	/**
	 * Sign in to a specific tenant workspace using the provided input.
	 *
	 * @param input - The input containing user email and token.
	 * @returns An observable of the response for signing in to the specific tenant workspace.
	 */
	signinWorkspaceByToken(input: IUserEmailInput & IUserTokenInput) {
		// Send a POST request to the server endpoint with the provided input
		return this.http.post<IAuthResponse>(`${API_PREFIX}/auth/signin.workspace`, input);
	}

	/**
	 * Logout API Route
	 *
	 * @returns
	 */
	doLogout(): Observable<boolean> {
		return this.http.get<boolean>(`${API_PREFIX}/auth/logout`);
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
		return firstValueFrom(this.http.post<{ token: string }>(`${API_PREFIX}/auth/refresh-token`, { refresh_token }));
	}

	public electronAuthentication({ user, token }: IAuthResponse) {
		try {
			if (this.electronService.isElectron) {
				const channel = this.isAgent ? 'AUTH_SUCCESS' : 'auth_success';
				const authArg = {
					user: user,
					token: token,
					userId: user.id,
					employeeId: user.employee ? user.employee.id : null,
					organizationId: user.employee ? user.employee.organizationId : null,
					tenantId: user.tenantId ? user.tenantId : null
				};
				if (this.isAgent) {
					this.electronService.ipcRenderer.invoke(channel, authArg);
				} else {
					this.electronService.ipcRenderer.send(channel, authArg);
				}
			}
		} catch (error) {
			console.log(error);
		}
	}

	private get isAgent() {
		return this._environment.IS_AGENT;
	}
}
