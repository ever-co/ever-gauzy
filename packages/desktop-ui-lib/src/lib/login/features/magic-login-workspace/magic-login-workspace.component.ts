import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IAuthResponse, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { asyncScheduler, catchError, EMPTY, filter, firstValueFrom, tap } from 'rxjs';
import { AuthService } from '../../../auth';
import { ErrorHandlerService, Store, TimeTrackerDateManager } from '../../../services';

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
	public confirmedEmail: string;
	public totalWorkspaces: number;
	public showPopup: boolean = false;
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlerService
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
						this.confirmSignInCode();
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
	async confirmSignInCode() {
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
								this.showPopup = show_popup;
								this.confirmedEmail = confirmed_email;
								this.totalWorkspaces = total_workspaces;

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

			await this._router.navigate(['/auth/login-magic']);
		}
	}

	/**
	 * Continue the workspace sign-in process.
	 */
	async signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmedEmail) {
			return; // Exit if the no workspace
		}

		this.showPopup = false;
		this.success = true;

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmedEmail;
		const token = workspace.token;
		// Send a request to sign in to the workspace using the authentication service
		this._authService
			.signinWorkspaceByToken({ email, token })
			.pipe(
				filter(({ user, token }: IAuthResponse) => !!user && !!token),
				tap((response: IAuthResponse) => {
					const user: IUser = response.user;
					const token: string = response.token;

					const { id, employee, tenantId } = user;

					if (employee) {
						TimeTrackerDateManager.organization = employee.organization;
						this._store.organizationId = employee.organizationId;
					}

					this._store.tenantId = tenantId;
					this._store.userId = id;
					this._store.token = token;
					this._store.user = user;

					asyncScheduler.schedule(() => {
						this._authService.electronAuthentication({ token, user });
					}, 3000);
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
