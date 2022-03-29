import { Observable, from, of } from 'rxjs';
import { NbAuthResult, NbAuthStrategy } from '@nebular/auth';
import { catchError, map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { IAuthResponse } from '@gauzy/contracts';
import { NbAuthStrategyClass } from '@nebular/auth/auth.options';
import { AuthService } from './services/auth.service';
import { Store } from './services/store.service';
import { ElectronService } from 'ngx-electron';

@Injectable()
export class AuthStrategy extends NbAuthStrategy {
	private static config = {
		login: {
			redirect: {
				success: '/time-tracker',
				failure: null
			},
			defaultErrors: [
				'Login/Email combination is not correct, please try again.'
			],
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
			defaultMessages: [
				'Reset password instructions have been sent to your email.'
			]
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

	authenticate(args: {
		email: string;
		password: string;
		rememberMe?: boolean | null;
	}): Observable<NbAuthResult> {
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
			new NbAuthResult(
				false,
				{},
				false,
				AuthStrategy.config.register.defaultErrors,
				[AuthStrategy.config.register.defaultErrors]
			)
		);
	}

	resetPassword(data?: any): Observable<NbAuthResult> {
		return of(
			new NbAuthResult(
				false,
				{},
				false,
				AuthStrategy.config.register.defaultErrors,
				[AuthStrategy.config.register.defaultErrors]
			)
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
						return new NbAuthResult(
							false,
							res,
							false,
							AuthStrategy.config.requestPass.defaultErrors
						);
					}
					return new NbAuthResult(
						true,
						res,
						false,
						[],
						AuthStrategy.config.requestPass.defaultMessages
					);
				}),
				catchError((err) => {
					console.log(err);
					return of(
						new NbAuthResult(
							false,
							err,
							false,
							AuthStrategy.config.requestPass.defaultErrors,
							[AuthStrategy.config.requestPass.defaultErrors]
						)
					);
				})
			);
	}

	refreshToken(data?: any): Observable<NbAuthResult> {
		throw new Error('Not implemented yet');
	}

	logout(): Observable<NbAuthResult> {
		return from(this._logout());
	}

	private async _logout(): Promise<NbAuthResult> {
		this.store.clear();
		this.store.serverConnection = 200;
		if (this.electronService.isElectronApp) {
			try {
				this.electronService.ipcRenderer.send('logout');
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
				let user, token;
				if (res) {
					user = res.user;
					token = res.token;
				}

				if (!user) {
					return new NbAuthResult(
						false,
						res,
						false,
						AuthStrategy.config.login.defaultErrors
					);
				}

				if (!user.employee) {
					return new NbAuthResult(
						false,
						res,
						false,
						AuthStrategy.config.login.roleErrors
					);
				}

				this.store.userId = user.id;
				this.store.token = token;

				this.electronAuthentication({ user, token });

				return new NbAuthResult(
					true,
					res,
					AuthStrategy.config.login.redirect.success,
					[],
					AuthStrategy.config.login.defaultMessages
				);
			}),
			catchError((err) => {
				console.log(err);
				return of(
					new NbAuthResult(
						false,
						err,
						false,
						AuthStrategy.config.login.defaultErrors,
						[AuthStrategy.config.login.defaultErrors]
					)
				);
			})
		);
	}

	public electronAuthentication({ user, token }: IAuthResponse) {
		try {
			if (this.electronService.isElectronApp) {
				this.electronService.ipcRenderer.send('auth_success', {
					token: token,
					userId: user.id,
					employeeId: user.employee ? user.employee.id : null,
					organizationId: user.employee
						? user.employee.organizationId
						: null,
					tenantId: user.tenantId ? user.tenantId : null
				});
			}
		} catch (error) {
			console.log(error);
		}
	}
}
