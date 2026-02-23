import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { NB_AUTH_OPTIONS, NbAuthService, NbLoginComponent } from '@nebular/auth';
import { NbButtonModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Subscription, catchError, filter, finalize, firstValueFrom, interval, tap } from 'rxjs';
import { AuthService } from '../../../auth';
import { GAUZY_ENV, patterns } from '../../../constants';
import { DebounceClickDirective } from '../../../directives/debounce-click.directive';
import { SpinnerButtonDirective } from '../../../directives/spinner-button.directive';
import { ErrorHandlerService } from '../../../services';
import { SwitchThemeComponent } from '../../../theme-selector/switch-theme/switch-theme.component';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { SocialLinksComponent } from '../../shared/ui/social-links/social-links.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-magic',
	templateUrl: './login-magic.component.html',
	styleUrls: ['./login-magic.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LogoComponent,
		SwitchThemeComponent,
		FormsModule,
		ReactiveFormsModule,
		NbFormFieldModule,
		NbInputModule,
		NbIconModule,
		DebounceClickDirective,
		NbButtonModule,
		SpinnerButtonDirective,
		RouterLink,
		SocialLinksComponent,
		TranslatePipe
	]
})
export class NgxLoginMagicComponent extends NbLoginComponent implements OnInit {
	public countdown: number;
	private timer: Subscription;

	public isLoading: boolean = false;
	public isCodeSent: boolean = false;
	public isCodeResent: boolean = false;
	public isDemo: boolean = false;

	/**
	 * FormGroup instance representing the magic login form.
	 */
	public form: FormGroup = NgxLoginMagicComponent.buildForm(this._fb);
	/**
	 * Static method to build the magic login form using Angular's FormBuilder.
	 *
	 * @param fb - Angular FormBuilder instance.
	 * @returns {FormGroup} - The built magic login form.
	 */
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			email: [null, Validators.compose([Validators.required, Validators.pattern(patterns.email)])],
			code: [null, Validators.compose([Validators.required, Validators.minLength(6), Validators.maxLength(6)])]
		});
	}

	/**
	 * Gets the 'email' AbstractControl from the form.
	 *
	 * @returns {AbstractControl} - The 'email' form control.
	 */
	get email(): AbstractControl {
		return this.form.get('email');
	}

	/**
	 * Gets the 'code' AbstractControl from the form.
	 *
	 * @returns {AbstractControl} - The 'code' form control.
	 */
	get code(): AbstractControl {
		return this.form.get('code');
	}

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly nbAuthService: NbAuthService,
		public readonly _cdr: ChangeDetectorRef,
		public readonly _router: Router,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlerService,
		@Inject(NB_AUTH_OPTIONS) options,
		@Inject(GAUZY_ENV)
		private readonly _environment: any
	) {
		super(nbAuthService, options, _cdr, _router);
		this.isDemo = this._environment.DEMO;
	}

	/**
	 *
	 */
	ngOnInit(): void {
		// Create an observable to listen to query parameter changes in the current route.
		this._activatedRoute.queryParams
			.pipe(
				// Filter and ensure that query parameters are present.
				filter((params: Params) => !!params),

				// Tap into the observable to update the 'form.email' property with the 'email' query parameter.
				tap(({ email }: Params) => {
					if (email) {
						this.form.patchValue({ email });
						this.form.updateValueAndValidity();
					}
				}),
				// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	ngOnDestroy(): void {
		this.stopTimer();
	}

	/**
	 * Initiates the login process.
	 *
	 * @remarks
	 * This method retrieves the email from the form, validates it, and sends a request to sign in
	 * to workspaces using the authentication service. Error handling and loading indicator management
	 * are included to ensure a smooth user experience.
	 *
	 * @returns An observable representing the login request.
	 */
	async sendLoginCode(): Promise<void> {
		// Get the email value from the form
		const email = this.form.get('email').value;
		if (!email) {
			return;
		}

		this.isLoading = true;
		this.isCodeSent = false;

		// Send a request to sign in to workspaces using the authentication service
		await firstValueFrom(
			this._authService.sendSigninCode({ email }).pipe(
				catchError((error) => {
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Turn off loading indicator
				finalize(() => {
					this.isLoading = false;
					this._cdr.markForCheck();
				}),
				tap(() => {
					this.isCodeSent = true;
					this.form.get('email').disable();
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
		); // Wait for the login request to complete
	}

	/**
	 * Resend the sign-in code.
	 */
	async onResendCode(): Promise<void> {
		// Start the timer
		this.startTimer();

		// Get the email value from the form
		const email = this.form.get('email').value;

		// Check if email is present
		if (!email) {
			return;
		}

		// Send a request to sign in to workspaces using the authentication service
		await firstValueFrom(
			this._authService.sendSigninCode({ email }).pipe(
				catchError((error) => {
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
		); // Wait for the login request to complete
	}

	/**
	 * Confirms the sign-in code.
	 * Uses navigation state instead of query params to avoid exposing code in URL.
	 */
	async confirmSignInCode(): Promise<void> {
		this.isLoading = true;
		// Check if the form is invalid
		if (this.form.invalid) {
			this.isLoading = false;
			return;
		}
		// Get the email and code values from the form
		const { email, code } = this.form.getRawValue();

		// Check if both email and code are present
		if (!email || !code) {
			this.isLoading = false;
			return;
		}

		// Navigate to the 'auth/magic-sign-in' route with email and code in state (not URL)
		// This prevents the code from being visible in browser history or URL bar
		await this._router.navigate(['auth/magic-sign-in'], {
			state: {
				email,
				code
			}
		});

		this.isLoading = false;
		this._cdr.markForCheck();
	}

	/**
	 * Starts a timer for a countdown.
	 */
	startTimer() {
		this.stopTimer();

		this.isCodeResent = true;
		this.countdown = 30;

		this.timer = interval(1000)
			.pipe(
				tap(() => {
					if (this.countdown > 0) {
						this.countdown--;
					} else {
						this.stopTimer();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Stops the timer and resets the code resent flag.
	 */
	stopTimer() {
		this.isCodeResent = false;
		if (this.timer) {
			this.timer.unsubscribe();
		}
	}
}
