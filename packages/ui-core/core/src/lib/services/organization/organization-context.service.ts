import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { AuthService } from '../auth/auth.service';
import { ToastrService } from '../notification/toastr.service';

/**
 * Service responsible for switching organization context.
 *
 * When a user switches organizations within the same tenant, this service:
 * 1. Calls the backend to generate a new JWT with the correct employeeId for the target organization
 * 2. Updates the store with the new tokens and user data
 * 3. Updates the selected organization in the store
 *
 * This ensures that the JWT always contains the correct employeeId for the current organization,
 * supporting the 1:N relationship between User and Employee.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationContextService {
	private readonly store = inject(Store);
	private readonly authService = inject(AuthService);
	private readonly toastrService = inject(ToastrService);

	/**
	 * Switch to a different organization within the same workspace.
	 * This generates a new JWT with the correct employeeId for the target organization.
	 *
	 * @param organization The organization to switch to
	 * @returns Promise that resolves when the switch is complete
	 */
	async switchOrganization(organization: IOrganization): Promise<boolean> {
		try {
			if (!organization?.id) {
				console.warn('[OrganizationContextService] No organization provided');
				return false;
			}

			// Check if we're already on this organization
			const currentOrgId = this.store.selectedOrganization?.id;
			if (currentOrgId === organization.id) {
				console.info('[OrganizationContextService] Already on this organization');
				return true;
			}

			// Call the backend to switch organization and get new tokens
			const response = await firstValueFrom(
				this.authService.switchOrganization(organization.id).pipe(
					catchError((error) => {
						console.error('[OrganizationContextService] Switch organization failed:', error);
						throw error;
					})
				)
			);

			if (!response) {
				this.toastrService.danger('Failed to switch organization', 'Error');
				return false;
			}

			// Apply the new authentication data
			const applied = this.applyOrganizationData(response, organization);
			if (!applied) {
				this.toastrService.danger('Failed to apply organization data', 'Error');
				return false;
			}

			return true;
		} catch (error) {
			console.error('[OrganizationContextService] Error switching organization:', error);
			this.toastrService.danger('Failed to switch organization. Please try again.', 'Error');
			return false;
		}
	}

	/**
	 * Apply the new organization data to the store after a successful switch.
	 *
	 * @param response The auth response from the switch organization API
	 * @param organization The target organization
	 * @returns true if applied successfully, false if validation failed
	 */
	private applyOrganizationData(response: IAuthResponse, organization: IOrganization): boolean {
		const { user, token, refresh_token } = response;

		// Validate required fields before updating store
		if (!token || !user) {
			console.error('[OrganizationContextService] Invalid response: missing token or user');
			return false;
		}

		// Update tokens
		this.store.token = token;
		if (refresh_token) {
			this.store.refresh_token = refresh_token;
		}

		// Update user with new employee context
		this.store.user = user;

		// Update organization context
		this.store.selectedOrganization = organization;
		this.store.organizationId = organization.id;
		this.store.selectedEmployee = null;

		console.info(`[OrganizationContextService] Switched to organization: ${organization.name}`);
		return true;
	}

	/**
	 * Initialize the service.
	 *
	 * @deprecated This method is retained for backward compatibility with AppInitService.
	 * Organization switching is now done explicitly via switchOrganization().
	 * This will be removed in a future version.
	 */
	initialize(): void {
		// No-op: Organization switching is now explicit via switchOrganization()
	}
}
