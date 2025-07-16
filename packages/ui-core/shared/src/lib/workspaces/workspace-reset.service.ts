import { Injectable, Optional, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IAuthResponse } from '@gauzy/contracts';
import {
	Store,
	AuthService,
	ToastrService,
	AppInitService,
	ElectronService,
	TimeTrackerService,
	TimesheetFilterService,
	OrganizationStore,
	OrganizationProjectAkitaStore,
	PermissionsService
} from '@gauzy/ui-core/core';
import { NgxPermissionsService } from 'ngx-permissions';
import { ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { deleteCookie } from '../../../../core/src/lib/auth/cookie-helper';

/**
 * Service for handling workspace switching with complete reset
 */
@Injectable({
	providedIn: 'root'
})
export class WorkspaceResetService {
	constructor(
		private readonly store: Store,
		private readonly authService: AuthService,
		private readonly toastrService: ToastrService,
		private readonly appInitService: AppInitService,
		private readonly electronService: ElectronService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly timesheetFilterService: TimesheetFilterService,
		private readonly organizationStore: OrganizationStore,
		private readonly organizationProjectStore: OrganizationProjectAkitaStore,
		private readonly permissionsService: PermissionsService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly applicationRef: ApplicationRef,
		private readonly injector: Injector
	) {}

	/**
	 * Switch workspace with complete reload approach
	 *
	 * @param workspaceId The ID of the workspace to switch to
	 * @returns Observable with the auth response
	 */
	public switchWorkspace(workspaceId: string): Observable<IAuthResponse> {
		// 1. Save important user preferences before switch (will persist through reload)
		const preferredLanguage = this.store.preferredLanguage;
		const themeName = localStorage.getItem('themeName');

		// 2. Call API to switch workspace FIRST (using current token)
		return this.authService.switchWorkspace(workspaceId).pipe(
			tap(async (response: IAuthResponse) => {
				if (!response) {
					throw new Error('Failed to switch workspace');
				}

				// 3. Apply new workspace data and reload
				await this.remountApplication(response, preferredLanguage, themeName);
			}),
			catchError((error) => {
				console.error('Error switching workspace:', error);
				this.toastrService.danger('Failed to switch workspace. Please try again.', 'Error');
				throw error;
			})
		);
	}

	/**
	 * Complete store reset - removes everything
	 */
	private async completeStoreReset(): Promise<void> {
		// 1. Clear time tracking and timesheet filter before reset
		await this.clearTimeTrackingData();

		// 2. Standard store reset
		this.store.clear();

		// 3. Manual reset of all important properties
		// Auth related
		this.store.token = null;
		this.store.refresh_token = null;
		this.store.userId = null;
		this.store.user = null;
		this.store.userRolePermissions = null;

		// Organization related
		this.store.organizationId = null;
		this.store.selectedOrganization = null;

		// Tenant related
		this.store.tenantId = null;

		// Employee related
		this.store.selectedEmployee = null;

		// Project related
		this.store.selectedProject = null;

		// Team related
		this.store.selectedTeam = null;

		// 4. Clear specialized Akita stores
		this.clearAkitaStores();

		// 5. Clear features and permissions
		this.clearFeaturesAndPermissions();

		// 6. Clean localStorage/sessionStorage related to store
		this.clearStorageData();

		// 7. Clear cache services
		this.clearCacheServices();

		// 8. Clean authentication cookies
		this.clearAuthenticationCookies();

		// 9. Force Angular change detection
		setTimeout(() => {
			console.log('Store reset completed - forcing change detection');
		}, 0);
	}

	/**
	 * Clear time tracking data before workspace switch
	 */
	private async clearTimeTrackingData(): Promise<void> {
		if (this.store.user && this.store.user.employee) {
			// Stop time tracking if running
			if (this.timeTrackerService.running) {
				if (this.timeTrackerService.timerSynced.isExternalSource) {
					this.timeTrackerService.remoteToggle();
				} else {
					await this.timeTrackerService.toggle();
				}
			}

			// Clear time tracker and timesheet filter
			this.timeTrackerService.clearTimeTracker();
			this.timesheetFilterService.clear();
		}
	}

	/**
	 * Clear authentication cookies
	 */
	private clearAuthenticationCookies(): void {
		deleteCookie('userId', { SameSite: 'None', Secure: true });
		deleteCookie('token', { SameSite: 'None', Secure: true });
		deleteCookie('refresh_token', { SameSite: 'None', Secure: true });
	}

	/**
	 * Clear localStorage/sessionStorage data related to store
	 */
	private clearStorageData(): void {
		// List of keys to preserve
		const keysToPreserve = ['themeName', 'preferredLanguage', 'serverConnection'];

		// Get all keys
		const allKeys = Object.keys(localStorage);

		// Remove all keys except those to preserve
		allKeys.forEach((key) => {
			if (!keysToPreserve.includes(key)) {
				localStorage.removeItem(key);
			}
		});

		// Same for sessionStorage if needed
		const sessionKeys = Object.keys(sessionStorage);
		sessionKeys.forEach((key) => {
			if (!keysToPreserve.includes(key)) {
				sessionStorage.removeItem(key);
			}
		});
	}

	/**
	 * Handle Electron authentication after workspace switch
	 */
	private electronAuthentication(response: IAuthResponse): void {
		try {
			if (this.electronService.isElectron) {
				const { user, token } = response;
				this.electronService.ipcRenderer.send('auth_success', {
					user: user,
					token: token,
					userId: user.id,
					employeeId: user.employee ? user.employee.id : null,
					organizationId: user.employee ? user.employee.organizationId : null,
					tenantId: user.tenantId ? user.tenantId : null
				});
			}
		} catch (error) {
			console.error('Electron authentication error:', error);
		}
	}

	/**
	 * Remount the application with complete reload
	 * This ensures a completely fresh state for the new workspace
	 */
	private async remountApplication(
		response: IAuthResponse,
		preferredLanguage: string,
		themeName: string
	): Promise<void> {
		try {
			// 1. Update store with new workspace data (like auth-strategy.login)
			const { user, token, refresh_token } = response;
			this.store.userId = user.id;
			this.store.token = token;
			this.store.refresh_token = refresh_token;
			this.store.organizationId = user?.employee?.organizationId;
			this.store.tenantId = user?.tenantId;
			this.store.user = user;

			// 2. Restore user preferences in localStorage (will persist through reload)
			localStorage.setItem('preferredLanguage', preferredLanguage);
			if (themeName) {
				localStorage.setItem('themeName', themeName);
			}

			// 3. Handle Electron authentication
			this.electronAuthentication(response);

			// 4. Show success notification before reload
			this.toastrService.success('Workspace switched successfully. Refreshing...', 'Success');

			// 5. SOLUTION PRAGMATIQUE: Complete page reload
			// This ensures 100% clean state for the new workspace
			window.location.reload();
		} catch (error) {
			console.error('Error switching workspace:', error);
			this.toastrService.danger('Failed to switch workspace', 'Error');
			throw error;
		}
	}

	/**
	 * Clear specialized Akita stores that may persist workspace-specific data
	 */
	private clearAkitaStores(): void {
		try {
			// Reset organization-related stores
			this.organizationStore.reset();
			this.organizationProjectStore.reset();

			// Clear Akita store data from localStorage
			this.clearAkitaLocalStorage();

			console.log('Akita stores cleared successfully');
		} catch (error) {
			console.warn('Error clearing Akita stores:', error);
		}
	}

	/**
	 * Clear Akita-related data from localStorage
	 */
	private clearAkitaLocalStorage(): void {
		try {
			const akitaPatterns = ['AkitaStores', 'akita', '@datorama', 'organization', 'project', 'app', 'persist'];

			const allKeys = Object.keys(localStorage);
			let clearedCount = 0;

			allKeys.forEach((key) => {
				akitaPatterns.forEach((pattern) => {
					if (
						key.toLowerCase().includes(pattern.toLowerCase()) &&
						!['themeName', 'preferredLanguage', 'serverConnection'].includes(key)
					) {
						localStorage.removeItem(key);
						clearedCount++;
					}
				});
			});

			console.log(`Cleared ${clearedCount} Akita-related entries from localStorage`);
		} catch (error) {
			console.warn('Error clearing Akita localStorage:', error);
		}
	}

	/**
	 * Clear features and permissions that may be workspace-specific
	 */
	private clearFeaturesAndPermissions(): void {
		// Clear feature-related data
		this.store.featureToggles = [];
		this.store.featureOrganizations = [];
		this.store.featureTenant = [];

		// Clear permissions from store
		this.store.userRolePermissions = [];

		// Clear permissions from NgxPermissionsService
		this.ngxPermissionsService.flushPermissions();
	}

	/**
	 * Clear ALL cache services that may hold workspace-specific data
	 */
	private clearCacheServices(): void {
		try {
			// Clear timesheet filter service
			this.timesheetFilterService.clear();

			// Clear time tracker service
			this.timeTrackerService.clearTimeTracker();
		} catch (error) {
			console.warn('Error clearing cache services:', error);
		}
	}
}
