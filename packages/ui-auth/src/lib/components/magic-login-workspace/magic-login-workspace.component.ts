import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { sleep } from '@gauzy/ui-core/common';
import { AuthService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-magic-sign-in-workspace',
	templateUrl: './magic-login-workspace.component.html',
	styleUrls: ['./magic-login-workspace.component.scss'],
	standalone: false
})
export class NgxMagicSignInWorkspaceComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _authService = inject(AuthService);
	private readonly _errorHandlingService = inject(ErrorHandlingService);

	public error: boolean = false;
	public success: boolean = false;
	public confirmed_email: string;
	public total_workspaces: number;
	public show_popup: boolean = false;
	public workspaces: IWorkspaceResponse[] = [];

	ngOnInit(): void {
		this._activatedRoute.queryParams
			.pipe(
				filter(({ email, code }: Params) => !!email && !!code),
				tap(() => this.confirmSignInCode()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Confirm the magic sign-in code and fetch available workspaces.
	 */
	async confirmSignInCode() {
		const { email, code } = this._activatedRoute.snapshot.queryParams;
		if (!email || !code) {
			return;
		}

		try {
			await firstValueFrom(
				this._authService.confirmSignInByCode({ email, code }).pipe(
					tap((response: IUserSigninWorkspaceResponse) => {
						if (response.confirmed_email) {
							this.workspaces = response.workspaces;
							this.show_popup = response.show_popup;
							this.confirmed_email = response.confirmed_email;
							this.total_workspaces = response.total_workspaces;

							// Auto sign-in for single workspace
							if (response.total_workspaces === 1) {
								this.signInWorkspace(response.workspaces[0]);
							}
						}
					}),
					untilDestroyed(this)
				)
			);
		} catch (error) {
			this.error = true;
			await sleep(5000);
			this._router.navigate(['/auth/login-magic']);
		}
	}

	/**
	 * Sign in to the selected workspace.
	 */
	async signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmed_email) {
			return;
		}

		this.show_popup = false;
		this.success = true;

		await sleep(2000);

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
