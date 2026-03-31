import { Component, inject, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, filter } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { AuthService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { PasswordFormFieldComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-workspace',
	templateUrl: './login-workspace.component.html',
	styleUrls: ['./login-workspace.component.scss'],
	standalone: false
})
export class NgxLoginWorkspaceComponent {
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _fb = inject(UntypedFormBuilder);
	private readonly _authService = inject(AuthService);
	private readonly _errorHandlingService = inject(ErrorHandlingService);

	public confirmed_email: string;
	public total_workspaces: number;
	public show_popup: boolean = false;
	public loading: boolean = false;
	public workspaces: IWorkspaceResponse[] = [];

	public form: UntypedFormGroup = this._fb.group({
		email: [null, [Validators.required, Validators.email]],
		password: [null, Validators.required]
	});

	@ViewChild(PasswordFormFieldComponent, { static: true }) password: PasswordFormFieldComponent;

	/**
	 * Handle the form submission.
	 */
	onSubmit() {
		if (this.form.invalid || this.loading) {
			return;
		}

		this.loading = true;

		const { email, password } = this.form.value;

		this._authService
			.findWorkspaces({ email, password })
			.pipe(
				tap((response: IUserSigninWorkspaceResponse) => {
					this.workspaces = response.workspaces;
					this.show_popup = response.show_popup;
					this.confirmed_email = response.confirmed_email;
					this.total_workspaces = response.total_workspaces;

					// Auto sign-in for single workspace
					if (response.total_workspaces === 1) {
						this.signInWorkspace(response.workspaces[0]);
					}
				}),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sign in to the selected workspace.
	 */
	signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmed_email) {
			return;
		}

		this._authService
			.signinWorkspaceByToken({ email: this.confirmed_email, token: workspace.token })
			.pipe(
				filter(({ user, token }: IAuthResponse) => !!user && !!token),
				tap((response: IAuthResponse) => this._handleLoginResponse(response)),
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Hydrate the store with the authenticated user session and navigate to the app.
	 */
	private _handleLoginResponse({ user, token, refresh_token }: IAuthResponse) {
		this._store.userId = user.id;
		this._store.user = user;
		this._store.token = token;
		this._store.refresh_token = refresh_token;
		this._store.organizationId = user.employee?.organizationId;
		this._store.tenantId = user.tenantId;

		this._router.navigate(['/']);
	}
}
