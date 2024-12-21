import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IAuthResponse, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
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
	public error: boolean = false;
	public success: boolean = false;
	public confirmed_email: string;
	public total_workspaces: number;
	public show_popup: boolean = false;
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit(): void {
		// Create an observable to listen to query parameter changes in the current route.
		this._activatedRoute.queryParams
			.pipe(
				// Filter and ensure that query parameters are present.
				filter((params: Params) => !!params),
				// Filter and ensure that query parameters are present.
				filter(({ email, code }: Params) => !!email && !!code),
				// Tap into the observable to update the 'form.email' property with the 'email' query parameter.
				tap(({ email, code }: Params) => {
					if (email && code) {
						this.confirmSingInCode();
					}
				}),
				// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Confirm the sign in code
	 */
	async confirmSingInCode() {
		// Get the email & code value from the query params
		const { email, code } = this._activatedRoute.snapshot.queryParams;
		if (!email || !code) {
			return;
		}

		try {
			// Send a request to sign in to workspaces using the authentication service
			await firstValueFrom(
				this._authService.confirmSignInByCode({ email, code }).pipe(
					// Update component state with the fetched workspaces
					tap(
						({
							workspaces,
							show_popup,
							total_workspaces,
							confirmed_email
						}: IUserSigninWorkspaceResponse) => {
							if (confirmed_email) {
								this.workspaces = workspaces;
								this.show_popup = show_popup;
								this.confirmed_email = confirmed_email;
								this.total_workspaces = total_workspaces;

								/** */
								if (total_workspaces == 1) {
									const [workspace] = workspaces;
									this.signInWorkspace(workspace);
								}
							}
						}
					),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				)
			); // Wait for the login request to complete
		} catch (error) {
			this.error = true;

			// Sleeps for 5 seconds before Redirecting you to the app
			const sleepDelay = 5000;
			await sleep(sleepDelay);

			this._router.navigate(['/auth/login-magic']);
		}
	}

	/**
	 * Continue the workspace sign-in process.
	 */
	async signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmed_email) {
			return; // Exit if the no workspace
		}

		this.show_popup = false;
		this.success = true;

		// Sleeps for 2 seconds before Redirecting you to the app
		const sleepDelay = 2000;
		await sleep(sleepDelay);

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmed_email;
		const token = workspace.token;

		try {
			// Send a request to sign in to the workspace using the authentication service
			this._authService
				.signinWorkspaceByToken({ email, token })
				.pipe(
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
		} catch (error) {
			console.log('Error while signing in workspace', error);
			this._errorHandlingService.handleError(error);
		}
	}
}
