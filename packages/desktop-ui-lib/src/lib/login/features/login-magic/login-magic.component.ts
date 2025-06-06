import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NB_AUTH_OPTIONS, NbAuthService, NbLoginComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EMPTY, Subscription, catchError, filter, finalize, firstValueFrom, interval, tap } from 'rxjs';
import { AuthService } from '../../../auth';
import { GAUZY_ENV, patterns } from '../../../constants';
import { ErrorHandlerService } from '../../../services';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-login-magic',
    templateUrl: './login-magic.component.html',
    styleUrls: ['./login-magic.component.scss'],
    standalone: false
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
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlerService,
		@Inject(NB_AUTH_OPTIONS) options,
		@Inject(GAUZY_ENV)
		private readonly _environment: any
	) {
		super(nbAuthService, options, cdr, router);
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

		// Navigate to the 'auth/magic-sign-in' route with email and code as query parameters
		await this.router.navigate(['auth/magic-sign-in'], {
			queryParams: {
				email,
				code
			}
		});

		this.isLoading = false;
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
