import { ChangeDetectorRef, Directive, OnDestroy } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService, Store, WorkspaceAuthService } from '@gauzy/ui-core/core';
import { patterns } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
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
	public countdown = 0;

	// Loading and state properties
	public isLoading = false;
	public isCodeSent = false;
	public isCodeResent = false;

	// Workspace selection state
	public workspaces: IWorkspaceResponse[] = [];
	public showWorkspaceSelection = false;
	public confirmedEmail: string | null = null;
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
	get email(): AbstractControl | null {
		return this.form.get('email');
	}

	/**
	 * Getter for the code form control.
	 */
	get code(): AbstractControl | null {
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
		this._timerService.timerState$.pipe(untilDestroyed(this)).subscribe((state) => {
			this.countdown = state.countdown;
			this.isCodeResent = state.isResent;
			this.cdr.markForCheck();
		});
	}

	ngOnDestroy(): void {
		this._timerService.stopTimer();
	}

	/**
	 * Sends the magic code for workspace authentication.
	 * This method is shared across all workspace auth components.
	 */
	async sendSigninCode(): Promise<void> {
		if (this.isLoading) {
			return;
		}
		// Get the email value from the form
		const email = (this.form.get('email').value || '').trim();
		if (!email) {
			return;
		}

		try {
			this.isLoading = true;
			await this._workspaceAuthService.sendSigninCode(email);
			this.isCodeSent = true;
			this.cdr.markForCheck();
		} catch {
			this.isCodeSent = false;
			this.cdr.markForCheck();
		} finally {
			this.isLoading = false;
			this.cdr.markForCheck();
		}
	}

	/**
	 * Resend the sign-in code.
	 * This method is shared across all workspace auth components.
	 */
	async onResendCode(): Promise<void> {
		if (this.isLoading) {
			return;
		}

		// Get the email value from the form
		const email = (this.form.get('email')?.value || '').trim();

		// Check if email is present
		if (!email) {
			return;
		}

		if (this.countdown > 0) {
			return;
		}

		try {
			this.isLoading = true;
			await this._workspaceAuthService.sendSigninCode(email);
			this.isCodeResent = true;
			this._timerService.startTimer();
			this.cdr.markForCheck();
		} catch {
			this.isCodeResent = false;
			this._timerService.stopTimer();
			this.cdr.markForCheck();
		} finally {
			this.isLoading = false;
			this.cdr.markForCheck();
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
		const raw = this.form.getRawValue();
		const email = (raw.email || '').trim();
		const code = (raw.code || '').trim();

		// Check if both email and code are present
		if (!email || !code) {
			return;
		}

		try {
			this.isLoading = true;
			const response = await this._workspaceAuthService.confirmSignInByCode(email, code);

			// Store the confirmed email for later use
			this.confirmedEmail = email;

			// Store workspace data
			this.workspaces = response?.workspaces || [];
			this.totalWorkspaces = response?.total_workspaces ?? this.workspaces.length;

			// Call the abstract method to handle component-specific logic
			this.handleConfirmationResponse(response);

			// Show workspace selection if there are workspaces
			if (this.workspaces.length > 0) {
				this.showWorkspaceSelection = true;
			}
			this.cdr.markForCheck();
		} catch (error) {
			this._errorHandlingService.handleError(error);
			this.showWorkspaceSelection = false;
			this.cdr.markForCheck();
		} finally {
			this.isLoading = false;
			this.cdr.markForCheck();
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

		try {
			this.isLoading = true;
			const email = this.confirmedEmail;
			const token = workspace.token;

			// Sign in to the selected workspace
			await this._workspaceAuthService.signInWorkspaceByToken(email, token);

			// Close the window after successful signin
			this.closeWindow();
			this.cdr.markForCheck();
		} catch (error) {
			this._errorHandlingService.handleError(error);
			this.cdr.markForCheck();
		} finally {
			this.isLoading = false;
			this.cdr.markForCheck();
		}
	}

	/**
	 * Updates the store with workspace authentication data.
	 * This method is shared across all workspace auth components.
	 */
	protected async updateStoreWithWorkspaceData(response: IAuthResponse): Promise<void> {
		await this._workspaceAuthService.updateStoreWithWorkspaceData(response);
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
	trackByWorkspaceId = (_: number, w: IWorkspaceResponse) => w?.user?.tenant?.id || w?.user?.id;
}
