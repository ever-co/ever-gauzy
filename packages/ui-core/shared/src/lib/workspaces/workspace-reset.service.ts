import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { catchError, takeUntil, tap } from 'rxjs/operators';
import { IAuthResponse } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store, AuthService, ToastrService, TimeTrackerService, TimesheetFilterService } from '@gauzy/ui-core/core';

/**
 * Service responsible for workspace switching with complete application reset.
 * Performs a full reset and data reload to ensure all components refresh properly.
 */
@Injectable({
	providedIn: 'root'
})
export class WorkspaceResetService implements OnDestroy {
	reset$: Subject<boolean> = new Subject();
	private destroy$ = new Subject<void>();

	constructor(
		private readonly store: Store,
		private readonly authService: AuthService,
		private readonly toastrService: ToastrService,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly timesheetFilterService: TimesheetFilterService
	) {
		this.reset$
			.pipe(
				distinctUntilChange(),
				tap(() => this._preReset()),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	/**
	 * Switch workspace with complete application reset.
	 *
	 * @param workspaceId The ID of the workspace to switch to
	 * @returns Observable with the auth response
	 */
	switchWorkspace(workspaceId: string): Observable<IAuthResponse> {
		// Save current preferences before switch
		const preferredLanguage = this.store.preferredLanguage;
		const themeName = localStorage.getItem('themeName');

		return this.authService.switchWorkspace(workspaceId).pipe(
			tap(async (response: IAuthResponse) => {
				// Apply new workspace data with complete reset
				await this.applyWorkspaceData(response, preferredLanguage, themeName);
			}),
			catchError((error) => {
				this.toastrService.danger('Failed to switch workspace', 'Error');
				throw error;
			})
		);
	}

	/**
	 * Apply new workspace data with complete application reset.
	 *
	 * @param response The auth response from workspace switch
	 * @param preferredLanguage User's preferred language
	 * @param themeName User's preferred theme
	 */
	private async applyWorkspaceData(
		response: IAuthResponse,
		preferredLanguage: string,
		themeName: string
	): Promise<void> {
		// STEP 1: Complete application reset
		await this._reset(preferredLanguage);

		// STEP 2: Apply new workspace data
		const { user, token, refresh_token } = response;
		this.store.userId = user.id;
		this.store.token = token;
		this.store.refresh_token = refresh_token;
		this.store.organizationId = user.employee?.organizationId;
		this.store.tenantId = user.tenantId;
		this.store.user = user;

		// STEP 3: Set organization
		if (user.employee?.organization) {
			this.store.selectedOrganization = user.employee.organization;
		}

		// STEP 4: Restore user preferences
		this.store.preferredLanguage = preferredLanguage;
		if (themeName) {
			localStorage.setItem('themeName', themeName);
		}

		// STEP 5: Success notification
		this.toastrService.success('Workspace switched successfully!', 'Success');

		// STEP 6: Reload page to ensure everything is refreshed
		// A full page reload is necessary to:
		// - Clear all in-memory state and caches
		// - Re-initialize all services with new workspace context
		// - Ensure all lazy-loaded modules are reloaded
		// - Reset any third-party libraries that maintain internal state
		window.location.reload();
	}

	/**
	 * Perform complete application reset
	 */
	private async _reset(preferredLanguage: string): Promise<void> {
		// Trigger pre-reset actions
		this.reset$.next(true);

		// Complete store reset
		this.store.clear();
		this.store.serverConnection = 200;
		this.store.preferredLanguage = preferredLanguage;
	}

	/**
	 * Pre-reset cleanup actions
	 */

	private async _preReset(): Promise<void> {
		// Clean up time tracking and timesheet filters
		if (this.store.user?.employee) {
			if (this.timeTrackerService.running) {
				if (this.timeTrackerService.timerSynced.isExternalSource) {
					this.timeTrackerService.remoteToggle();
				} else {
					await this.timeTrackerService.toggle();
				}
			}
			this.timeTrackerService.clearTimeTracker();
			this.timesheetFilterService.clear();
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.reset$.complete();
	}
}
