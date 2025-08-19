import { Injectable } from '@angular/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UntilDestroy } from '@ngneat/until-destroy';
import { IAuthResponse, IOrganizationCreateInput, IUserSigninWorkspaceResponse, IWorkSpace } from '@gauzy/contracts';
import { AuthService } from '../auth';
import { ErrorHandlingService } from '../notification';
import { Store } from '../store';
import { TenantService } from '../tenant';
import { OrganizationsService } from '../organizations';
import { UsersService } from '../users';
import { WorkspaceSyncService } from './workspace-sync.service';

/**
 * Service to handle workspace authentication flows and user onboarding.
 * Centralizes complex authentication logic that was previously duplicated across components.
 */
@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class WorkspaceAuthService {
	constructor(
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _tenantService: TenantService,
		private readonly _organizationsService: OrganizationsService,
		private readonly _usersService: UsersService,
		private readonly _workspaceSyncService: WorkspaceSyncService
	) {}

	/**
	 * Get new access token using refresh token stored in _store
	 */
	async getAccessTokenFromRefreshToken(): Promise<void> {
		try {
			const { refresh_token } = this._store;
			if (refresh_token) {
				const { token } = await this._authService.refreshToken(refresh_token);
				if (token) {
					this._store.token = token;
				}
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Handle complete user onboarding flow for workspace creation.
	 * Flow: signup → signin (get token) → create tenant → refresh token → create organization
	 *
	 * @param organization Organization creation input data
	 * @param userRegistrationData User registration data (firstName, lastName, password, confirmPassword)
	 * @param confirmedEmail The confirmed email from magic code flow
	 * @returns Promise<void>
	 */
	async onboardUser(
		organization: IOrganizationCreateInput,
		userRegistrationData: {
			firstName: string;
			lastName: string;
			password: string;
			confirmPassword: string;
		},
		confirmedEmail: string
	): Promise<void> {
		if (!confirmedEmail) {
			throw new Error('No confirmed email found');
		}

		const { firstName, lastName, password, confirmPassword } = userRegistrationData;

		// Step 0: Clear the store to avoid conflicts with existing user data
		this._store.clear();

		// Step 1: Create a new user without tenant using the register service
		const newUser = await firstValueFrom(
			this._authService
				.register({
					user: {
						firstName: firstName,
						lastName: lastName,
						email: confirmedEmail
					},
					password: password,
					confirmPassword: confirmPassword
				})
				.pipe(
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return throwError(() => error);
					})
				)
		);

		if (!newUser) {
			throw new Error('Failed to create new user');
		}

		// Step 2: Login as the new user to get auth token
		const authResponse = await firstValueFrom(
			this._authService
				.login({
					email: confirmedEmail,
					password: password
				})
				.pipe(
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return throwError(() => error);
					})
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

		// Step 8: Update workspace states
		await this.updateWorkspaceStates(tenant.id);

		// Step 9: Broadcast workspace creation to other tabs
		if (this._workspaceSyncService.isSupported()) {
			this._workspaceSyncService.broadcastWorkspaceCreated({
				tenantId: tenant.id,
				organizationId: createdOrganization.id,
				workspaceName: createdOrganization.name
			});
		}
	}

	/**
	 * Updates workspace states after successful authentication or creation.
	 *
	 * @param selectedTenantId The ID of the tenant to mark as selected
	 */
	private async updateWorkspaceStates(selectedTenantId: string): Promise<void> {
		await firstValueFrom(
			this._authService.getUserWorkspaces(false).pipe(
				tap(({ workspaces }: IUserSigninWorkspaceResponse) => {
					const mappedWorkspaces: IWorkSpace[] = workspaces.map((workspace) => ({
						id: workspace.user.tenant.id,
						name: workspace.user.tenant.name,
						imgUrl: workspace.user.tenant.logo || '/assets/images/default.svg',
						isOnline: true,
						isSelected: workspace.user.tenant.id === selectedTenantId
					}));

					// Update store with workspaces
					this._store.setWorkspaces(mappedWorkspaces, selectedTenantId);
				}),
				catchError(() => {
					this._store.setWorkspacesLoading(false, 'Failed to load workspaces');
					return of({ workspaces: [], total_workspaces: 0 } as IUserSigninWorkspaceResponse);
				})
			)
		);
	}

	/**
	 * Updates the store with workspace authentication data.
	 * This is a centralized method for consistent store updates across components.
	 *
	 * @param response The authentication response containing user and token data
	 * @returns Promise<void> to wait for complete store update
	 */
	async updateStoreWithWorkspaceData(response: IAuthResponse): Promise<void> {
		this._store.clear();
		const { user, token: authToken, refresh_token } = response;

		// Update store with user data
		this._store.userId = user.id;
		this._store.user = user;
		this._store.token = authToken;
		this._store.refresh_token = refresh_token;
		this._store.organizationId = user.employee?.organizationId;
		this._store.tenantId = user.tenantId;

		// Update workspace states and wait for completion
		await this.updateWorkspaceStates(user.tenantId);
	}

	/**
	 * Handles workspace sign-in using token.
	 * Centralizes the workspace sign-in logic that was duplicated across components.
	 *
	 * @param email The confirmed email
	 * @param token The workspace token
	 * @returns Promise<void> - resolves when store is fully updated
	 * @throws Error if signin fails
	 */
	async signInWorkspaceByToken(email: string, token: string): Promise<void> {
		const response = await firstValueFrom(
			this._authService.signinWorkspaceByToken({ email, token }).pipe(
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return throwError(() => error);
				})
			)
		);

		// Ensure we have a valid response
		if (!response) {
			throw new Error('No response received from signin');
		}

		// Wait for complete store update before resolving
		await this.updateStoreWithWorkspaceData(response);

		// Broadcast workspace signin to other tabs
		if (this._workspaceSyncService.isSupported()) {
			this._workspaceSyncService.broadcastWorkspaceSignin({
				tenantId: response.user.tenantId,
				organizationId: response.user.employee?.organizationId
			});
		}
	}

	/**
	 * Sends magic code for workspace authentication.
	 * Centralizes the code sending logic that was duplicated across components.
	 *
	 * @param email The email to send the code to
	 * @returns Promise<unknown>
	 */
	async sendSigninCode(email: string): Promise<unknown> {
		return firstValueFrom(
			this._authService.sendSigninCode({ email }).pipe(
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return throwError(() => error);
				})
			)
		);
	}

	/**
	 * Confirms the sign-in code and returns workspace information.
	 * Centralizes the code confirmation logic that was duplicated across components.
	 *
	 * @param email The email address
	 * @param code The verification code
	 * @returns Promise<IUserSigninWorkspaceResponse>
	 */
	async confirmSignInByCode(email: string, code: string): Promise<IUserSigninWorkspaceResponse> {
		return firstValueFrom(
			this._authService.confirmSignInByCode({ email, code }).pipe(
				catchError((error) => {
					this._errorHandlingService.handleError(error);
					return throwError(() => error);
				})
			)
		);
	}
}
