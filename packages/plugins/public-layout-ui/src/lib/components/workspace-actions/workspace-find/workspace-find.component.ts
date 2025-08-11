import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { EMPTY, Subscription, finalize, firstValueFrom, interval } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IUserSigninWorkspaceResponse, IWorkSpace, IWorkspaceResponse } from '@gauzy/contracts';
import { AuthService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { patterns } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-workspace-find',
	templateUrl: './workspace-find.component.html',
	styleUrls: ['./workspace-find.component.scss'],
	standalone: false
})
export class WorkspaceFindComponent extends TranslationBaseComponent implements OnInit {
	public countdown: number;
	private timer: Subscription;

	public isLoading: boolean = false;
	public isCodeSent: boolean = false;
	public isCodeResent: boolean = false;

	// Workspace selection state
	public workspaces: IWorkspaceResponse[] = [];
	public showWorkspaceSelection: boolean = false;
	public confirmedEmail: string;
	public totalWorkspaces: number = 0;

	/**
	 * FormGroup instance representing the workspace find form.
	 */
	public form: UntypedFormGroup = WorkspaceFindComponent.buildForm(this._fb);

	/**
	 * Static method to build the workspace find form using Angular's FormBuilder.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			email: [null, Validators.compose([Validators.required, Validators.pattern(patterns.email)])],
			code: [null, Validators.compose([Validators.required, Validators.minLength(6), Validators.maxLength(6)])]
		});
	}

	/**
	 * Getter for the email form control.
	 */
	get email(): AbstractControl {
		return this.form.get('email');
	}

	/**
	 * Getter for the code form control.
	 */
	get code(): AbstractControl {
		return this.form.get('code');
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		public readonly cdr: ChangeDetectorRef,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Component initialization
	}

	/**
	 * Sends the magic code for workspace find.
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
		);
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

		try {
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
			);
		} catch (error) {
			// Handle errors
			console.error('Error while resending sign-in code:', error);
		}
	}

	/**
	 * Confirms the sign-in code and shows existing workspaces.
	 */
	async confirmSignInCode(): Promise<void> {
		// Check if the form is invalid
		if (this.form.invalid) {
			return;
		}

		// Get the email and code values from the form
		const { email, code } = this.form.getRawValue();

		// Check if both email and code are present
		if (!email || !code) {
			return;
		}

		this.isLoading = true;

		try {
			// Confirm the sign-in code and get workspace information
			await firstValueFrom(
				this._authService.confirmSignInByCode({ email, code }).pipe(
					tap((response: IUserSigninWorkspaceResponse) => {
						const { workspaces, show_popup, total_workspaces, confirmed_email } = response;

						this.workspaces = workspaces;
						this.showWorkspaceSelection = show_popup;
						this.confirmedEmail = confirmed_email;
						this.totalWorkspaces = total_workspaces;

						// Always show workspace selection for find
						if (total_workspaces > 0) {
							this.showWorkspaceSelection = true;
						}
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					finalize(() => {
						this.isLoading = false;
					}),
					untilDestroyed(this)
				)
			);
		} catch (error) {
			console.error('Error while confirming sign-in code:', error);
			this.isLoading = false;
		}
	}

	/**
	 * Starts a timer for a countdown.
	 */
	startTimer() {
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
	 * Stops the timer.
	 */
	stopTimer() {
		this.isCodeResent = false;
		if (this.timer) {
			this.timer.unsubscribe();
		}
	}

	/**
	 * Handle workspace selection - sign in to existing workspace
	 */
	async signInWorkspace(workspace: IWorkspaceResponse): Promise<void> {
		if (!workspace || !this.confirmedEmail) {
			return;
		}

		this.isLoading = true;

		try {
			const email = this.confirmedEmail;
			const token = workspace.token;

			// Sign in to the selected workspace
			await firstValueFrom(
				this._authService.signinWorkspaceByToken({ email, token }).pipe(
					tap((response: any) => {
						const { user, token: authToken, refresh_token } = response;

						// Update store with user data
						this._store.userId = user.id;
						this._store.user = user;
						this._store.token = authToken;
						this._store.refresh_token = refresh_token;
						this._store.organizationId = user.employee?.organizationId;
						this._store.tenantId = user.tenantId;

						// Update workspace states using the store
						const currentWorkspaces = this._store.workspaces;
						const updatedWorkspaces = currentWorkspaces.map((w: IWorkSpace) => ({
							...w,
							isSelected: w.id === user.tenantId,
							isOnline: w.id === user.tenantId ? true : w.isOnline
						}));

						// Update store with new workspace states
						this._store.setWorkspaces(updatedWorkspaces, user.tenantId);
						window.location.href = '/';
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					finalize(() => {
						this.isLoading = false;
					}),
					untilDestroyed(this)
				)
			);
		} catch (error) {
			console.error('Error while signing in to workspace:', error);
			this.isLoading = false;
		}
	}

	/**
	 * Close the current window/tab
	 */
	closeWindow(): void {
		// Try to close the window
		if (window.opener) {
			window.close();
		} else {
			// If can't close, redirect to main app
			window.location.href = '/#/';
		}
	}
}
