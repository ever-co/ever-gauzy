import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NavigationExtras, Router, RouterLink } from '@angular/router';
import { HttpStatus, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { NB_AUTH_OPTIONS, NbAuthService, NbLoginComponent } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, EMPTY, tap } from 'rxjs';
import { AuthService } from '../auth';
import { GAUZY_ENV } from '../constants';
import { SpinnerButtonDirective } from '../directives/spinner-button.directive';
import { ElectronService } from '../electron/services';
import { LanguageElectronService } from '../language/language-electron.service';
import { ErrorHandlerService } from '../services';
import { SwitchThemeComponent } from '../theme-selector/switch-theme/switch-theme.component';
import { LogoComponent } from './shared/ui/logo/logo.component';
import { SocialLinksComponent } from './shared/ui/social-links/social-links.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LogoComponent,
		SwitchThemeComponent,
		NbAlertModule,
		FormsModule,
		NbInputModule,
		NbFormFieldModule,
		NbButtonModule,
		NbIconModule,
		NbCheckboxModule,
		SpinnerButtonDirective,
		NgStyle,
		RouterLink,
		SocialLinksComponent,
		TranslatePipe
	]
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
		private readonly errorHandlingService: ErrorHandlerService,
		@Inject(NB_AUTH_OPTIONS)
		options: any,
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.languageElectronService.initialize<void>();
		if (this.isAgent) {
			this.user.rememberMe = true;
		}
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
				tap((response) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				// Update component state with the fetched workspaces
				tap(
					async ({
						workspaces,
						show_popup,
						total_workspaces,
						confirmed_email
					}: IUserSigninWorkspaceResponse) => {
						if (total_workspaces === 1) {
							super.login();
						} else {
							const extra: NavigationExtras = {
								state: {
									confirmed_email,
									workspaces,
									show_popup
								}
							};
							await this.router.navigate(['/', 'auth', 'login-workspace'], extra);
							this.submitted = false;
						}
					}
				),
				catchError((error) => {
					this.submitted = false;
					// Handle and log errors using the error handling service
					this.errorHandlingService.handleError(error);
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

	get isAgent(): boolean {
		return this.environment.IS_AGENT;
	}
}
