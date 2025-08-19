import { ChangeDetectorRef, Component, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IOrganizationCreateInput, IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService, Store, MatchValidator, WorkspaceAuthService } from '@gauzy/ui-core/core';
import { BaseWorkspaceAuthComponent, CountdownTimerService } from '../shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-workspace-create',
	templateUrl: './workspace-create.component.html',
	styleUrls: ['./workspace-create.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceCreateComponent extends BaseWorkspaceAuthComponent {
	// Creation step state
	public showCreationStep = false;
	public showAccountCreation = false;
	public showPassword = false;
	public showConfirmPassword = false;

	/**
	 * FormGroup instance representing the account creation form (profile + password).
	 */
	public accountForm: UntypedFormGroup = WorkspaceCreateComponent.buildAccountForm(this._fb);

	/**
	 * Static method to build the account creation form using Angular's FormBuilder.
	 * Reuses existing form validation patterns from AcceptInviteFormComponent
	 */
	static buildAccountForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group(
			{
				fullName: [null, Validators.required],
				password: [null, Validators.compose([Validators.required, Validators.minLength(4)])],
				confirmPassword: [null, Validators.required]
			},
			{ validators: [MatchValidator.mustMatch('password', 'confirmPassword')] }
		);
	}

	/**
	 * Getter for the fullName form control.
	 */
	get fullName(): AbstractControl {
		return this.accountForm.controls['fullName'];
	}

	/**
	 * Getter for the password form control.
	 */
	get password(): AbstractControl {
		return this.accountForm.controls['password'];
	}

	/**
	 * Getter for the confirmPassword form control.
	 */
	get confirmPassword(): AbstractControl {
		return this.accountForm.controls['confirmPassword'];
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
		super(translateService, _fb, cdr, _errorHandlingService, _store, _workspaceAuthService, _timerService);
	}

	/**
	 * Handle edit email button click
	 */
	onEditEmail(): void {
		this.isCodeSent = false;
		this.form.get('email').enable();
		this.form.get('code').reset();
		this.isCodeResent = false;
		this._timerService.stopTimer();
	}

	/**
	 * Continue to account creation step (fullName, password)
	 */
	continueToCreation(): void {
		this.showWorkspaceSelection = false;
		this.showAccountCreation = true;
	}

	/**
	 * Continue to workspace creation step after account creation
	 */
	continueToWorkspaceCreation(): void {
		if (this.accountForm.invalid) {
			this.accountForm.markAllAsTouched();
			return;
		}
		this.showAccountCreation = false;
		this.showCreationStep = true;
	}

	/**
	 * Handle component-specific logic after confirmation response.
	 * For workspace creation: show workspace selection if user has workspaces, otherwise go to creation.
	 */
	protected handleConfirmationResponse(response: IUserSigninWorkspaceResponse): void {
		const { total_workspaces } = response;

		// If user has workspaces, show selection
		if (total_workspaces > 0) {
			this.showWorkspaceSelection = true;
			this.showAccountCreation = false;
			this.showCreationStep = false;
		} else {
			this.showWorkspaceSelection = false;
			this.showAccountCreation = false;
			this.showCreationStep = true;
		}
	}

	/**
	 * Handle workspace creation from onboarding form using the workspace auth service.
	 */
	async onboardUser(organization: IOrganizationCreateInput): Promise<void> {
		this.isLoading = true;

		try {
			// Ensure account form is valid before using its values
			if (this.accountForm.invalid) {
				this.accountForm.markAllAsTouched();
				return;
			}
			// Get user registration data from account form
			const { fullName, password, confirmPassword } = this.accountForm.getRawValue();

			// Split fullName into firstName and lastName for the service
			const parts = fullName.trim().split(/\s+/);
			const [firstName = '', ...rest] = parts;
			const lastName = rest.join(' ');
			const userRegistrationData = {
				firstName,
				lastName,
				password,
				confirmPassword
			};

			// Use the workspace auth service to handle the complex onboarding flow
			await this._workspaceAuthService.onboardUser(organization, userRegistrationData, this.confirmedEmail);

			window.location.href = '/';
		} catch (error) {
			this._errorHandlingService.handleError(error);
		} finally {
			this.isLoading = false;
		}
	}
}
