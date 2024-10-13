import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpStatus, IAuthResponse, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { asyncScheduler, catchError, EMPTY, filter, tap } from 'rxjs';
import { AuthService } from '../../../auth';
import { ErrorHandlerService, Store, TimeTrackerDateManager } from '../../../services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-workspace',
	templateUrl: './login-workspace.component.html',
	styleUrls: ['./login-workspace.component.scss']
})
export class NgxLoginWorkspaceComponent {
	public confirmedEmail: string;
	public totalWorkspaces: number;
	public showPopup: boolean = false;
	public loading: boolean = false; // Flag to indicate if data loading is in progress
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users
	public showPassword = false;

	/** The FormGroup for the sign-in form */
	public form: FormGroup = NgxLoginWorkspaceComponent.buildForm(this._fb);

	/**
	 * Static method to build a FormGroup for the sign-in form.
	 *
	 * @param fb - The FormBuilder service for creating form controls.
	 * @returns A FormGroup for the sign-in form.
	 */
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			email: new FormControl(null, [Validators.required, Validators.email]), // Email input with email validation
			password: new FormControl(null, [Validators.required]) // Password input with required validation
		});
	}

	constructor(
		private readonly _store: Store,
		private readonly _fb: FormBuilder,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlerService
	) {}

	/**
	 * Handle the form submission.
	 */
	onSubmit() {
		if (this.form.invalid) {
			return; // Exit if the form is invalid
		}

		//
		this.loading = true;

		// Get the values of email and password from the form
		const email = this.email.value;
		const password = this.password.value;

		// Send a request to sign in to workspaces using the authentication service
		this._authService
			.findWorkspaces({ email, password })
			.pipe(
				tap((response) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				// Update component state with the fetched workspaces
				tap(({ workspaces, show_popup, total_workspaces, confirmed_email }: IUserSigninWorkspaceResponse) => {
					this.workspaces = workspaces;
					this.showPopup = show_popup;
					this.confirmedEmail = confirmed_email;
					this.totalWorkspaces = total_workspaces;
					/** */
					if (total_workspaces == 1) {
						const [workspace] = this.workspaces;
						this.signInWorkspace(workspace);
					} else {
						this.loading = false;
					}
				}),
				catchError((error) => {
					// Handle and log errors using the error handling service
					this.loading = false;
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Continue the workspace sign-in process.
	 */
	signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmedEmail) {
			return; // Exit if the no workspace
		}

		this.loading = true;

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmedEmail;
		const token = workspace.token;

		// Send a request to sign in to the workspace using the authentication service
		this._authService
			.signinWorkspaceByToken({ email, token })
			.pipe(
				tap((response) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				filter(({ user, token }: IAuthResponse) => !!user && !!token),
				tap((response: IAuthResponse) => {
					const user: IUser = response.user;
					const token: string = response.token;

					const { id, employee, tenantId } = user;
					TimeTrackerDateManager.organization = employee.organization;
					this._store.organizationId = employee.organizationId;
					this._store.tenantId = tenantId;
					this._store.userId = id;
					this._store.token = token;
					this._store.user = user;

					asyncScheduler.schedule(() => {
						this._authService.electronAuthentication({ token, user });
						this.loading = false;
					}, 3000);
				}),
				catchError((error) => {
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					this.loading = false;
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get password() {
		return this.form.get('password');
	}

	public get email() {
		return this.form.get('email');
	}
}
