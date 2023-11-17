import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EMPTY, Subscription, finalize, firstValueFrom, interval } from "rxjs";
import { catchError, filter, tap } from 'rxjs/operators';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@env/environment';
import { HttpStatus, IAuthResponse, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { patterns } from '../../@shared/regex/regex-patterns.const';
import { AuthService, ErrorHandlingService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-magic',
	templateUrl: './login-magic.component.html',
	styleUrls: ['./login-magic.component.scss']
})
export class NgxLoginMagicComponent extends NbLoginComponent implements OnInit {

	public countdown: number;
	private timer: Subscription;

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
		private readonly _store: Store,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	/**
	 *
	 */
	ngOnInit(): void {
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
					this.isCodeSent = true;
				}),
				tap(() => this.form.get('email').disable()),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
		); // Wait for the login request to complete
	}

	/**
	 *
	 */
	async onResendCode() {
		this.startTimer();

		// Get the email value from the form
		const email = this.form.get('email').value;
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
	 *
	 */
	async confirmSingInCode() {
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
				tap((response: any) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
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

					/** */
					if (total_workspaces == 1) {
						const [workspace] = this.workspaces;
						this.signInWorkspace(workspace);
					}
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
		); // Wait for the login request to complete
	}

	/**
	 *
	 */
	startTimer() {
		this.isCodeResent = true;
		this.countdown = 30;

		this.timer = interval(1000).pipe(
			tap(() => {
				if (this.countdown > 0) {
					this.countdown--;
				} else {
					this.stopTimer();
				}
			}),
			untilDestroyed(this)
		).subscribe();
	}

	/**
	 *
	 */
	stopTimer() {
		this.isCodeResent = false;
		if (this.timer) {
			this.timer.unsubscribe();
		}
	}

	/**
	 * Continue the workspace sign-in process.
	 */
	signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmed_email) {
			return; // Exit if the no workspace
		}

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmed_email;
		const token = workspace.token;

		// Send a request to sign in to the workspace using the authentication service
		this._authService.signinWorkspaceByToken({ email, token }).pipe(
			tap((response: any) => {
				if (response['status'] === HttpStatus.UNAUTHORIZED) {
					throw new Error(`${response['message']}`);
				}
			}),
			filter(({ user, token }: IAuthResponse) => !!user && !!token),
			tap((response: IAuthResponse) => {
				const user: IUser = response.user;
				const token: string = response.token;
				const refresh_token: string = response.refresh_token;

				/** */
				this._store.userId = user.id;
				this._store.user = user;
				this._store.token = token;
				this._store.refresh_token = refresh_token;
				this._store.organizationId = user.employee?.organizationId;
				this._store.tenantId = user.tenantId;

				this.router.navigate(['/']);
			}),
			catchError((error) => {
				// Handle and log errors using the error handling service
				this._errorHandlingService.handleError(error);
				return EMPTY;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		).subscribe();
	}
}
