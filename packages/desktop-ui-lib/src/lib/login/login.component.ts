import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NavigationExtras, Router } from '@angular/router';
import { HttpStatus, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { NB_AUTH_OPTIONS, NbAuthService, NbLoginComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { catchError, EMPTY, tap } from 'rxjs';
import { AuthService } from '../auth';
import { ElectronService } from '../electron/services';
import { LanguageElectronService } from '../language/language-electron.service';
import { GAUZY_ENV } from '../constants';
import { ErrorHandlerService } from '../services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	@ViewChild('form')
	public form: NgForm;
	public showPassword = false;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public readonly languageElectronService: LanguageElectronService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		private readonly authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlerService,
		@Inject(NB_AUTH_OPTIONS)
		options: any,
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.languageElectronService.initialize<void>();
	}

	public override login(): void {
		if (!this.form || this.form.invalid) {
			return; // Exit if the form is invalid
		}

		this.submitted = true;

		// Get the values of email and password from the form
		const email = this.user.email;
		const password = this.user.password;

		// Send a request to sign in to workspaces using the authentication service
		this.authService
			.findWorkspaces({ email, password })
			.pipe(
				tap((response: any) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				// Update component state with the fetched workspaces
				tap(async ({ total_workspaces }: IUserSigninWorkspaceResponse) => {
					/** */
					if (total_workspaces === 1) {
						super.login();
					} else {
						const extra: NavigationExtras = {
							state: {
								email,
								password
							}
						};
						await this.router.navigate(['/', 'auth', 'login-workspace'], extra);
						this.submitted = false;
					}
				}),
				catchError((error) => {
					this.submitted = false;
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	public forgot(): void {
		this.electronService.shell.openExternal(this.forgotPasswordUrl);
	}

	public register(): void {
		this.electronService.shell.openExternal(this.registerUrl);
	}

	get forgotPasswordUrl(): string {
		return this.environment.FORGOT_PASSWORD_URL || 'https://app.gauzy.co/#/auth/request-password';
	}

	get registerUrl(): string {
		return this.environment.REGISTER_URL || 'https://app.gauzy.co/#/auth/register';
	}
}
