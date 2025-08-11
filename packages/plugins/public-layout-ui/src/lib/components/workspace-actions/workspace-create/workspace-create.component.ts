import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';

import { EMPTY, Subscription, finalize, firstValueFrom, interval, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	IAuthResponse,
	IOrganizationCreateInput,
	IUserSigninWorkspaceResponse,
	IWorkSpace,
	IWorkspaceResponse
} from '@gauzy/contracts';
import {
	AuthService,
	ErrorHandlingService,
	Store,
	TenantService,
	OrganizationsService,
	UsersService,
	MatchValidator
} from '@gauzy/ui-core/core';

import { patterns } from '@gauzy/ui-core/shared';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-workspace-create',
	templateUrl: './workspace-create.component.html',
	styleUrls: ['./workspace-create.component.scss'],
	standalone: false
})
export class WorkspaceCreateComponent extends TranslationBaseComponent implements OnInit {
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

	// Creation step state
	public showCreationStep: boolean = false;
	public showAccountCreation: boolean = false;

	/**
	 * FormGroup instance representing the workspace creation form.
	 */
	public form: UntypedFormGroup = WorkspaceCreateComponent.buildForm(this._fb);

	/**
	 * FormGroup instance representing the account creation form (profile + password).
	 */
	public accountForm: UntypedFormGroup = WorkspaceCreateComponent.buildAccountForm(this._fb);

	/**
	 * Static method to build the workspace creation form using Angular's FormBuilder.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			email: [null, Validators.compose([Validators.required, Validators.pattern(patterns.email)])],
			code: [null, Validators.compose([Validators.required, Validators.minLength(6), Validators.maxLength(6)])]
		});
	}

	/**
	 * Static method to build the account creation form using Angular's FormBuilder.
	 * Reuses existing form validation patterns from AcceptInviteFormComponent
	 */
	static buildAccountForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group(
			{
				firstName: [null, Validators.required],
				lastName: [null, Validators.required],
				password: [null, Validators.compose([Validators.required, Validators.minLength(4)])],
				confirmPassword: [null, Validators.required]
			},
			{ validators: [MatchValidator.mustMatch('password', 'confirmPassword')] }
		);
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

	/**
	 * Getter for the firstName form control.
	 */
	get firstName(): AbstractControl {
		return this.accountForm.get('firstName');
	}

	/**
	 * Getter for the lastName form control.
	 */
	get lastName(): AbstractControl {
		return this.accountForm.get('lastName');
	}

	/**
	 * Getter for the password form control.
	 */
	get password(): AbstractControl {
		return this.accountForm.get('password');
	}

	/**
	 * Getter for the confirmPassword form control.
	 */
	get confirmPassword(): AbstractControl {
		return this.accountForm.get('confirmPassword');
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		public readonly cdr: ChangeDetectorRef,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _tenantService: TenantService,
		private readonly _organizationsService: OrganizationsService,
		private readonly _usersService: UsersService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Component initialization
	}

	/**
	 * Sends the magic code for workspace creation.
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
	 * Confirms the sign-in code and shows existing workspaces or creation step.
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

						// If user has workspaces, show selection
						if (total_workspaces > 0) {
							this.showWorkspaceSelection = true;
						} else {
							// No workspaces, go directly to creation
							this.showCreationStep = true;
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
					tap((response: IAuthResponse) => {
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
	 * Continue to account creation step (firstName, lastName, password)
	 */
	continueToCreation(): void {
		this.showWorkspaceSelection = false;
		this.showAccountCreation = true;
	}

	/**
	 * Continue to workspace creation step after account creation
	 */
	continueToWorkspaceCreation(): void {
		this.showAccountCreation = false;
		this.showCreationStep = true;
	}

	/**
	 * Get new access token using refresh token stored in _store
	 */
	async getAccessTokenFromRefreshToken() {
		try {
			const { refresh_token } = this._store;
			if (refresh_token) {
				const { token } = await this._authService.refreshToken(refresh_token);
				if (token) {
					this._store.token = token;
				}
			}
		} catch (error) {
			console.error('Error while retrieving refresh token', error);
		}
	}

	/**
	 * Handle workspace creation from onboarding form
	 * Flow: signup → signin (get token) → create tenant → refresh token → create organization
	 */
	async onboardUser(organization: IOrganizationCreateInput): Promise<void> {
		this.isLoading = true;

		try {
			// Step 0: Clear the store to avoid conflicts with existing user data

			this._store.clear();

			// Get the email from the confirmed email in the magic code flow
			const email = this.confirmedEmail;
			if (!email) {
				throw new Error('No confirmed email found');
			}

			// Get user registration data from account form
			const { firstName, lastName, password, confirmPassword } = this.accountForm.getRawValue();

			// Step 1: Create a new user without tenant using the register service
			const newUser = await firstValueFrom(
				this._authService
					.register({
						user: {
							firstName: firstName,
							lastName: lastName,
							email: email
							// No tenant - this is key!
						},
						password: password,
						confirmPassword: confirmPassword
					})
					.pipe(
						catchError((error) => {
							this._errorHandlingService.handleError(error);
							return EMPTY;
						}),
						untilDestroyed(this)
					)
			);

			if (!newUser) {
				throw new Error('Failed to create new user');
			}

			// Step 2: Login as the new user to get auth token
			const authResponse = await firstValueFrom(
				this._authService
					.login({
						email: email,
						password: password
					})
					.pipe(
						catchError((error) => {
							this._errorHandlingService.handleError(error);
							return EMPTY;
						}),
						untilDestroyed(this)
					)
			);

			if (!authResponse || !authResponse.token) {
				throw new Error('Failed to authenticate new user');
			}

			// Update store with new user authentication
			this._store.userId = authResponse.user.id;
			this._store.user = authResponse.user;
			this._store.token = authResponse.token;
			this._store.refresh_token = authResponse.refresh_token;

			// Step 3: Create tenant using the tenant service (this will onboard the user)
			const tenant = await this._tenantService.create({ name: organization.name });

			if (!tenant) {
				throw new Error('Failed to create tenant');
			}

			// Step 4: Get updated user info (now has tenant and role)
			const user = await this._usersService.getMe(['tenant']);
			this._store.user = user;

			// Step 5: Get new access token with updated permissions
			await this.getAccessTokenFromRefreshToken();

			// Step 6: Create organization using the organizations service (now user has permissions)
			const createdOrganization = await this._organizationsService.create({
				...organization,
				tenant,
				isDefault: true
			});

			if (!createdOrganization) {
				throw new Error('Failed to create organization');
			}

			// Step 7: Update store with new user and workspace data
			this._store.userId = user.id;
			this._store.user = user;
			this._store.organizationId = createdOrganization.id;
			this._store.tenantId = tenant.id;

			// Update workspace states
			this._authService
				.getUserWorkspaces(false)
				.pipe(
					tap(({ workspaces }: IUserSigninWorkspaceResponse) => {
						const mappedWorkspaces: IWorkSpace[] = workspaces.map((workspace) => ({
							id: workspace.user.tenant.id,
							name: workspace.user.tenant.name,
							imgUrl: workspace.user.tenant.logo || '/assets/images/default.svg',
							isOnline: true,
							isSelected: workspace.user.tenant.id === tenant.id
						}));

						// Update store with workspaces
						this._store.setWorkspaces(mappedWorkspaces, tenant.id);
					}),
					catchError(() => {
						this._store.setWorkspacesLoading(false, 'Failed to load workspaces');

						return of({ workspaces: [], total_workspaces: 0 } as IUserSigninWorkspaceResponse);
					}),
					untilDestroyed(this)
				)
				.subscribe();

			window.location.href = '/';
		} catch (error) {
			console.error('Error while creating workspace:', error);
			this._errorHandlingService.handleError(error);
		} finally {
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
