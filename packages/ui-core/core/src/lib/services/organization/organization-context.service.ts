import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, skip, switchMap, tap, debounceTime, catchError } from 'rxjs/operators';
import { IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { UsersService } from '../users/users.service';

/**
 * Service responsible for maintaining user context synchronization when the selected organization changes.
 *
 * When a user switches organizations within the same tenant, this service automatically refreshes
 * the user data (including the correct employee for the new organization) from the backend.
 *
 * This ensures that `store.user.employee` always contains the employee record for the current organization,
 * supporting the 1:N relationship between User and Employee (one user can have multiple employees
 * across different organizations within the same tenant).
 */
@Injectable({ providedIn: 'root' })
export class OrganizationContextService implements OnDestroy {
	/** Subscription for organization changes listener */
	private subscription: Subscription | null = null;

	/** Subject to trigger manual refresh */
	private readonly refreshTrigger$ = new Subject<void>();

	/** Flag to track if the service has been initialized */
	private initialized = false;

	/** Cache the last organization ID to detect real changes */
	private lastOrganizationId: string | null = null;

	constructor(
		private readonly store: Store,
		private readonly usersService: UsersService
	) {}

	/**
	 * Initialize the organization context listener.
	 * Should be called once at application startup (e.g., in AppInitService).
	 *
	 * The listener:
	 * 1. Skips the first emission (initial load is handled by AppInitService)
	 * 2. Debounces to avoid multiple rapid calls
	 * 3. Filters out null/undefined organizations
	 * 4. Only triggers when organization ID actually changes
	 * 5. Calls the API to refresh user data with the correct employee
	 */
	initialize(): void {
		if (this.initialized) {
			return;
		}

		this.initialized = true;

		// Store the initial organization ID
		const currentOrg = this.store.selectedOrganization;
		this.lastOrganizationId = currentOrg?.id || null;

		this.subscription = this.store.selectedOrganization$
			.pipe(
				// Skip the first emission (initial load handled by AppInitService)
				skip(1),
				// Debounce to avoid multiple rapid API calls
				debounceTime(100),
				// Filter out null/undefined organizations
				filter((org: IOrganization | null): org is IOrganization => !!org?.id),
				// Only proceed if organization ID actually changed
				distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
				// Filter out if same as last known organization
				filter((org: IOrganization) => {
					const changed = org.id !== this.lastOrganizationId;
					if (changed) {
						this.lastOrganizationId = org.id;
					}
					return changed;
				}),
				// Switch to the API call
				switchMap(() => this.refreshUserContext()),
				// Handle errors gracefully
				catchError((error) => {
					console.error('[OrganizationContextService] Failed to refresh user context:', error);
					return [];
				})
			)
			.subscribe();
	}

	/**
	 * Refresh the user context by fetching updated user data from the backend.
	 * The backend will return the employee record for the current organization
	 * based on the Organization-Id header.
	 */
	private async refreshUserContext(): Promise<IUser | null> {
		try {
			// Check if user is logged in
			if (!this.store.userId) {
				return null;
			}

			const relations = [
				'role',
				'tenant',
				'tenant.featureOrganizations',
				'tenant.featureOrganizations.feature'
			];

			// Fetch updated user with employee for current organization
			const user = await this.usersService.getMe(relations, true);

			// Update the store with new user data
			if (user) {
				this.store.user = user;
			}

			return user;
		} catch (error) {
			console.error('[OrganizationContextService] Error refreshing user context:', error);
			throw error;
		}
	}

	/**
	 * Manually trigger a user context refresh.
	 * Can be called when needed outside of organization changes.
	 */
	triggerRefresh(): void {
		this.refreshTrigger$.next();
	}

	/**
	 * Cleanup subscriptions when service is destroyed
	 */
	ngOnDestroy(): void {
		if (this.subscription) {
			this.subscription.unsubscribe();
			this.subscription = null;
		}
		this.refreshTrigger$.complete();
	}
}

