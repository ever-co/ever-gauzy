import { Component, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, filter } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HttpStatus, IAuthResponse, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { ErrorHandlingService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { AuthService } from '@gauzy/ui-core/core';
import { PasswordFormFieldComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-workspace',
	templateUrl: './login-workspace.component.html',
	styleUrls: ['./login-workspace.component.scss']
})
export class NgxLoginWorkspaceComponent implements OnInit {
	public confirmed_email: string;
	public total_workspaces: number;
	public show_popup: boolean = false;
	public loading: boolean = false; // Flag to indicate if data loading is in progress
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users

	/** The FormGroup for the sign-in form */
	public form: UntypedFormGroup = NgxLoginWorkspaceComponent.buildForm(this._fb);

	/**
	 * Static method to build a FormGroup for the sign-in form.
	 *
	 * @param fb - The FormBuilder service for creating form controls.
	 * @returns A FormGroup for the sign-in form.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			email: [null, [Validators.required, Validators.email]], // Email input with email validation
			password: [null, Validators.required] // Password input with required validation
		});
	}

	/** */
	@ViewChild(PasswordFormFieldComponent, { static: true }) password: PasswordFormFieldComponent;

	constructor(
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _fb: UntypedFormBuilder,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit(): void {}

	/**
	 * Handle the form submission.
	 */
	onSubmit() {
		if (this.form.invalid) {
			return; // Exit if the form is invalid
		}

		try {
			//
			this.loading = true;

			// Get the values of email and password from the form
			const email = this.form.get('email').value;
			const password = this.form.get('password').value;

			// Send a request to sign in to workspaces using the authentication service
			this._authService
				.findWorkspaces({ email, password })
				.pipe(
					tap((response: any) => {
						if (response['status'] === HttpStatus.UNAUTHORIZED) {
							throw new Error(`${response['message']}`);
						}
					}),
					// Update component state with the fetched workspaces
					tap(
						({
							workspaces,
							show_popup,
							total_workspaces,
							confirmed_email
						}: IUserSigninWorkspaceResponse) => {
							this.workspaces = workspaces;
							this.show_popup = show_popup;
							this.confirmed_email = confirmed_email;
							this.total_workspaces = total_workspaces;
							/** */
							if (total_workspaces == 1) {
								const [workspace] = this.workspaces;
								this.signInWorkspace(workspace);
							}
						}
					),
					catchError((error) => {
						// Handle and log errors using the error handling service
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					tap(() => (this.loading = false)), // Turn off loading indicator
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			console.log(error);
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
		this._authService
			.signinWorkspaceByToken({ email, token })
			.pipe(
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

					this._router.navigate(['/']);
				}),
				catchError((error) => {
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}
}
