import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, EMPTY, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { AuthService, AuthStrategy } from '../../../auth';
import { ErrorHandlerService } from '../../../services';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { WorkspaceSelectionComponent } from '../../shared/ui/workspace-selection/workspace-selection.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-magic-sign-in-workspace',
	templateUrl: './magic-login-workspace.component.html',
	styleUrls: ['./magic-login-workspace.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [WorkspaceSelectionComponent, LogoComponent, TranslatePipe]
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
		private readonly _authService: AuthService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _errorHandlingService: ErrorHandlerService
	) {
		// Try to get email and code from navigation state first (secure method)
		const navigation = this._router.getCurrentNavigation();
		const state = navigation?.extras?.state;

		if (state?.email && state?.code) {
			// Code passed via state (secure)
			this.confirmSignInCode(state.email, state.code);
		}
	}

	ngOnInit(): void {
		// Fallback: Check query params for backward compatibility
		// Note: This is less secure as code is visible in URL
		this._activatedRoute.queryParams
			.pipe(
				filter((params: Params) => !!params),
				filter(({ email, code }: Params) => !!email && !!code),
				tap(({ email, code }: Params) => {
					console.warn(
						'[MagicLogin] Code received via URL query params (insecure). Use navigation state instead.'
					);
					this.confirmSignInCode(email, code);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Confirm the sign in code
	 * @param email User email
	 * @param code Magic code
	 */
	async confirmSignInCode(email: string, code: string) {
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
				switchMap((response: IAuthResponse) => {
					// Store authentication data using centralized method
					this._authStrategy.storeAuthenticationData(response);
					return this._authService.electronAuthentication(response);
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
