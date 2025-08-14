import { ChangeDetectorRef, Directive, OnDestroy } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { patterns } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { WorkspaceAuthService } from './workspace-auth.service';
import { CountdownTimerService } from './countdown-timer.service';

/**
 * Abstract base component for workspace authentication flows when user is already connected.
 * Contains shared functionality for magic code authentication, timer management,
 * and workspace selection that is common across workspace-create, workspace-signin, and workspace-find components.
 */
@UntilDestroy({ checkProperties: true })
@Directive()
export abstract class BaseWorkspaceAuthComponent extends TranslationBaseComponent implements OnDestroy {
	// Timer properties
	public countdown: number;

	// Loading and state properties
	public isLoading = false;
	public isCodeSent = false;
	public isCodeResent = false;

	// Workspace selection state
	public workspaces: IWorkspaceResponse[] = [];
	public showWorkspaceSelection = false;
	public confirmedEmail: string;
	public totalWorkspaces = 0;

	/**
	 * FormGroup instance representing the email and code form.
	 * This is the common form structure used by all workspace auth components.
	 */
	public form: UntypedFormGroup;

	/**
	 * Static method to build the common email/code form using Angular's FormBuilder.
	 */
	static buildEmailCodeForm(fb: UntypedFormBuilder): UntypedFormGroup {
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
		protected readonly _fb: UntypedFormBuilder,
		public readonly cdr: ChangeDetectorRef,
		protected readonly _errorHandlingService: ErrorHandlingService,
		protected readonly _store: Store,
		protected readonly _workspaceAuthService: WorkspaceAuthService,
		protected readonly _timerService: CountdownTimerService
	) {
		super(translateService);
		this.form = BaseWorkspaceAuthComponent.buildEmailCodeForm(this._fb);
	}

	ngOnDestroy(): void {
		this._timerService.stopTimer();
	}

	/**
	 * Sends the magic code for workspace authentication.
	 * This method is shared across all workspace auth components.
	 */
	async sendSigninCode(): Promise<void> {
		// Get the email value from the form
		const email = this.form.get('email').value;
		if (!email) {
			return;
		}
		try {
			await this._workspaceAuthService.sendSigninCode(email);
			this.isCodeSent = true;
		} catch {
			this.isCodeSent = false;
		}
	}

	/**
	 * Resend the sign-in code.
	 * This method is shared across all workspace auth components.
	 */
	async onResendCode(): Promise<void> {
		// Start the timer
		this._timerService.startTimer();

		// Get the email value from the form
		const email = this.form.get('email').value;

		// Check if email is present
		if (!email) {
			return;
		}
		try {
			await this._workspaceAuthService.sendSigninCode(email);
			this.isCodeResent = true;
		} catch {
			this.isCodeResent = false;
		}
	}

	/**
	 * Confirms the sign-in code and processes the response.
	 * This method is shared but allows for different handling logic via the abstract method.
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
			const response = await this._workspaceAuthService.confirmSignInByCode(email, code);

			// Store the confirmed email for later use
			this.confirmedEmail = email;

			// Store workspace data
			this.workspaces = response.workspaces || [];
			this.totalWorkspaces = this.workspaces.length;

			// Call the abstract method to handle component-specific logic
			this.handleConfirmationResponse(response);

			// Show workspace selection if there are workspaces
			if (this.workspaces.length > 0) {
				this.showWorkspaceSelection = true;
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
			this.showWorkspaceSelection = false;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Abstract method to handle component-specific logic after confirmation response.
	 * Each component will implement this differently based on their specific needs.
	 */
	protected abstract handleConfirmationResponse(response: IUserSigninWorkspaceResponse): void;

	/**
	 * Handle workspace selection - sign in to existing workspace.
	 * This method is shared across all workspace auth components.
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
			await this._workspaceAuthService.signInWorkspaceByToken(email, token);

			// Close the window after successful signin
			this.closeWindow();
		} catch (error) {
			this._errorHandlingService.handleError(error);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Updates the store with workspace authentication data.
	 * This method is shared across all workspace auth components.
	 */
	protected updateStoreWithWorkspaceData(response: IAuthResponse): void {
		this._workspaceAuthService.updateStoreWithWorkspaceData(response);
	}

	/**
	 * Close the current window/tab or redirect to main app.
	 * This method is shared across all workspace auth components.
	 */
	closeWindow(): void {
		window.location.href = '/';
	}

	/**
	 * Track by function for workspace lists.
	 * This method is shared across all workspace auth components.
	 */
	trackByWorkspaceId = (_: number, w: any) => w?.user?.tenant?.id || w?.user?.id || w?.id;
}
