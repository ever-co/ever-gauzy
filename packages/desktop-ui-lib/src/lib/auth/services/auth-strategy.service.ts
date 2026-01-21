import { Injectable } from '@angular/core';
import { IAuthResponse } from '@gauzy/contracts';
import { NbAuthResult, NbAuthStrategy, NbAuthStrategyClass } from '@nebular/auth';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ElectronService } from '../../electron/services';
import { Store, TimeTrackerDateManager } from '../../services';
import { AuthService } from './auth.service';

@Injectable()
export class AuthStrategy extends NbAuthStrategy {
	private static config = {
		login: {
			redirect: {
				success: '/time-tracker',
				failure: null
			},
			defaultErrors: ['Login/Email combination is not correct, please try again.'],
			defaultMessages: ['You have been successfully logged in.'],
			roleErrors: ['Your account is not an employee']
		},
		register: {
			redirect: {
				success: '/time-tracker',
				failure: null
			},
			defaultErrors: ['Something went wrong, please try again.'],
			defaultMessages: ['You have been successfully registered.']
		},
		logout: {
			redirect: {
				success: '/auth/login',
				failure: null
			},
			defaultErrors: ['Something went wrong, please try again.'],
			defaultMessages: ['You have been successfully logged out.']
		},
		requestPass: {
			redirect: {
				success: '/',
				failure: null
			},
			defaultErrors: ['Email is not correct, please try again.'],
			defaultMessages: ['Reset password instructions have been sent to your email.']
		},
		resetPass: {
			redirect: {
				success: '/',
				failure: null
			},
			resetPasswordTokenKey: 'reset_password_token',
			defaultErrors: ['Something went wrong, please try again.'],
			defaultMessages: ['Your password has been successfully changed.']
		}
	};

	constructor(
		private readonly authService: AuthService,
		private readonly store: Store,
		private readonly electronService: ElectronService
	) {
		super();
	}

	static setup(options: { name: string }): [NbAuthStrategyClass, any] {
		return [AuthStrategy, options];
	}

	authenticate(args: { email: string; password: string; rememberMe?: boolean | null }): Observable<NbAuthResult> {
		const { email, password } = args;
		// TODO implement remember me feature
		// const rememberMe = !!args.rememberMe;
		return this.login({
			email,
			password
		});
	}

	register(data?: any): Observable<NbAuthResult> {
		return of(
			new NbAuthResult(false, {}, false, AuthStrategy.config.register.defaultErrors, [
				AuthStrategy.config.register.defaultErrors
			])
		);
	}

	resetPassword(data?: any): Observable<NbAuthResult> {
		return of(
			new NbAuthResult(false, {}, false, AuthStrategy.config.register.defaultErrors, [
				AuthStrategy.config.register.defaultErrors
			])
		);
	}

	requestPassword(args: { email: string }): Observable<NbAuthResult> {
		const { email } = args;
		return this.authService
			.requestPassword({
				email
			})
			.pipe(
				map((res: { token: string }) => {
					let token;
					if (res) {
						token = res.token;
					}
					if (!token) {
						return new NbAuthResult(false, res, false, AuthStrategy.config.requestPass.defaultErrors);
					}
					return new NbAuthResult(true, res, false, [], AuthStrategy.config.requestPass.defaultMessages);
				}),
				catchError((err) => {
					console.log(err);
					return of(
						new NbAuthResult(false, err, false, AuthStrategy.config.requestPass.defaultErrors, [
							AuthStrategy.config.requestPass.defaultErrors
						])
					);
				})
			);
	}

	refreshToken(): Observable<NbAuthResult> {
		const refreshToken = this.store.refreshToken;

		if (!refreshToken) {
			return of(
				new NbAuthResult(false, null, false, ['No refresh token available'], ['No refresh token available'])
			);
		}

		return this.authService.refreshToken(refreshToken).pipe(
			map((res: { token: string }) => {
				if (!res || !res.token) {
					return new NbAuthResult(false, res, false, ['Failed to refresh token']);
				}

				// Update access token in store
				// Note: Refresh token stays the same on backend
				this.store.token = res.token;

				// Set token expiry (extract exp claim from JWT or use default 1 hour)
				this.setTokenExpiry(res.token);

				return new NbAuthResult(true, res, false, [], ['Token refreshed successfully']);
			}),
			catchError((error) => {
				console.error('Token refresh failed:', error);
				return of(new NbAuthResult(false, error, false, ['Token refresh failed'], ['Token refresh failed']));
			})
		);
	}

	logout(): Observable<NbAuthResult> {
		return from(this._logout());
	}

	private async _logout(): Promise<NbAuthResult> {
		this.store.clear();
		this.store.serverConnection = 200;
		if (this.electronService.isElectron) {
			try {
				await this.electronService.ipcRenderer.invoke('FINAL_LOGOUT');
			} catch (error) {}
		}

		return new NbAuthResult(
			true,
			null,
			AuthStrategy.config.logout.redirect.success,
			[],
			AuthStrategy.config.logout.defaultMessages
		);
	}

	public login(loginInput): Observable<NbAuthResult> {
		return this.authService.login(loginInput).pipe(
			map((res: IAuthResponse) => {
				let user, token, refreshToken;
				if (res) {
					user = res.user;
					token = res.token;
					refreshToken = res.refresh_token;
				}

				if (!user) {
					return new NbAuthResult(false, res, false, AuthStrategy.config.login.defaultErrors);
				}

				if (!user.employee) {
					return new NbAuthResult(false, res, false, AuthStrategy.config.login.roleErrors);
				}

				// Set stored values on login
				const { id, employee, tenantId } = user;
				TimeTrackerDateManager.organization = employee.organization;
				this.store.organizationId = employee.organizationId;
				this.store.tenantId = tenantId;
				this.store.userId = id;
				this.store.token = token;
				this.store.user = user;
				this.store.refreshToken = refreshToken;

				// Set token expiry time
				this.setTokenExpiry(token);

				this.authService.electronAuthentication({ user, token, refresh_token: refreshToken });

				return new NbAuthResult(
					true,
					res,
					AuthStrategy.config.login.redirect.success,
					[],
					AuthStrategy.config.login.defaultMessages
				);
			}),
			catchError((err) => {
				const isLoginOffline = !!this.store?.user && !!this.store?.token;
				if (isLoginOffline) {
					const res: IAuthResponse = {
						user: this.store.user,
						token: this.store.token,
						refresh_token: this.store.refreshToken
					};
					this.authService.electronAuthentication(res);
					return of(
						new NbAuthResult(
							true,
							res,
							AuthStrategy.config.login.redirect.success,
							[],
							AuthStrategy.config.login.defaultMessages
						)
					);
				}
				return of(
					new NbAuthResult(false, err, false, AuthStrategy.config.login.defaultErrors, [
						AuthStrategy.config.login.defaultErrors
					])
				);
			})
		);
	}

	/**
	 * Extracts expiry time from JWT token or sets default expiry (1 hour)
	 * @param token JWT token
	 */
	private setTokenExpiry(token: string): void {
		try {
			// Decode JWT to get expiry claim
			const payload = JSON.parse(atob(token.split('.')[1]));
			if (payload.exp) {
				// exp is in seconds, convert to milliseconds
				this.store.tokenExpiresAt = payload.exp * 1000;
			} else {
				// Default to 1 hour if no exp claim
				this.store.tokenExpiresAt = Date.now() + 60 * 60 * 1000;
			}
		} catch (error) {
			console.warn('Failed to parse token expiry, using default 1 hour:', error);
			// Default to 1 hour
			this.store.tokenExpiresAt = Date.now() + 60 * 60 * 1000;
		}
	}
}
