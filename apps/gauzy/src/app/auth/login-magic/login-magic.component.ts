import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { EMPTY, delay, finalize, firstValueFrom } from "rxjs";
import { catchError, filter, tap } from 'rxjs/operators';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@env/environment';
import { IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { patterns } from '../../@shared/regex/regex-patterns.const';
import { AuthService, ErrorHandlingService } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-magic',
	templateUrl: './login-magic.component.html',
	styleUrls: ['./login-magic.component.scss']
})
export class NgxLoginMagicComponent extends NbLoginComponent implements OnInit {

	public isLoading: boolean = false;
	public isCodeSent: boolean = false;
	public isCodeResent: boolean = false;
	public isDemo: boolean = environment.DEMO;

	public confirmed_email: string;
	public total_workspaces: number;
	public show_popup: boolean = false;
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users

	/**
	 * Magic Login Form
	 */
	public form: FormGroup = NgxLoginMagicComponent.buildForm(this._fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			email: [
				null, Validators.compose([
					Validators.required,
					Validators.pattern(patterns.email)
				])
			],
			code: [null, Validators.compose([
				Validators.required,
				Validators.minLength(6),
				Validators.maxLength(6),
			])]
		});
	}

	/**
	 *
	 */
	get email(): AbstractControl {
		return this.form.get('email');
	}

	/**
	 *
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
		private readonly _errorHandlingService: ErrorHandlingService,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	/**
	 *
	 */
	ngOnInit() {
		// Create an observable to listen to query parameter changes in the current route.
		this._activatedRoute.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),

			// Tap into the observable to update the 'form.email' property with the 'email' query parameter.
			tap(({ email }: Params) => {
				if (email) {
					this.form.setValue({ email });
					this.form.updateValueAndValidity();
				}
			}),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		).subscribe();
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
		try {
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
					// delay(10000),
					catchError((error) => {
						// Handle and log errors using the error handling service
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Turn off loading indicator
					finalize(() => {
						this.isLoading = false;
						this.isCodeSent = true;
					}),
					tap(() => this.form.get('email').disable()),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				)
			); // Wait for the login request to complete
		} catch (error) {
			// Handle and log errors using the error handling service
			console.error(error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 *
	 */
	async onResendCode() {
		setTimeout(() => { }, 30000)//30 seconds
	}

	/**
	 *
	 */
	async confirmSingInCode() {
		try {
			if (this.form.invalid) {
				return;
			}
			// Get the email &code value from the form
			const { email, code } = this.form.getRawValue();
			if (!email || !code) {
				return;
			}

			// Send a request to sign in to workspaces using the authentication service
			await firstValueFrom(
				this._authService.confirmSignInByCode({ email, code }).pipe(
					catchError((error) => {
						// Handle and log errors using the error handling service
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Update component state with the fetched workspaces
					tap(({ workspaces, show_popup, total_workspaces, confirmed_email }: IUserSigninWorkspaceResponse) => {
						this.workspaces = workspaces;
						this.show_popup = show_popup;
						this.confirmed_email = confirmed_email;
						this.total_workspaces = total_workspaces;
					}),
					tap(() => this.form.get('email').enable()),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				)
			); // Wait for the login request to complete
		} catch (error) {
			// Handle and log errors using the error handling service
			console.error(error);
			this._errorHandlingService.handleError(error);
		}
	}
}
