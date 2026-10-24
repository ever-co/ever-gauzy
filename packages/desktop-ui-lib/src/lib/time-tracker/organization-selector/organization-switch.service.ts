import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { AuthStrategy } from '../../auth/services/auth-strategy.service';
import { ElectronService } from '../../electron/services';
import { ErrorMapping } from '../../services/error-mapping.service';
import { Store } from '../../services/store.service';
import { ToastrNotificationService } from '../../services/toastr-notification.service';
import { UserOrganizationCacheService } from '../../services/user-organization-cache.service';

/**
 * Moves the desktop timer to another organization of the user's tenant.
 *
 * The API confines a non-admin to the organization named in their access token (ever-co/ever-gauzy#11316), so
 * changing the selected organization locally is not enough: every list would come back empty and every write would be
 * refused. Like the Gauzy web UI (`OrganizationContextService` in `@gauzy/ui-core/core`), this calls
 * `POST /auth/switch-organization` first, and only once the API has issued tokens for the new organization does it
 * store them (renderer store and Electron main process, the way the desktop sign-in does) and move the selection.
 * When the API refuses, nothing changes and the user is told why.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationSwitchService {
	constructor(
		private readonly _authService: AuthService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _store: Store,
		private readonly _electronService: ElectronService,
		private readonly _userOrganizationCacheService: UserOrganizationCacheService,
		private readonly _toastrNotificationService: ToastrNotificationService,
		private readonly _translateService: TranslateService,
		private readonly _errorMapping: ErrorMapping
	) {}

	/**
	 * Switch the timer to `organization`.
	 *
	 * @param organization The organization the user picked.
	 * @returns `true` when the timer now works in `organization`; `false` when the switch was refused or failed, in
	 * which case the timer still works in the organization it was in before.
	 */
	public async switchOrganization(organization: IOrganization): Promise<boolean> {
		if (!organization?.id) {
			return false;
		}

		// The organization the session works in: the one the access token was issued for at sign-in or last switch.
		const currentOrganizationId = this._store.organizationId;
		if (organization.id === currentOrganizationId) {
			return true;
		}

		let response: IAuthResponse | null;
		try {
			response = await firstValueFrom(this._authService.switchOrganization(organization.id));
		} catch (error) {
			console.error('[OrganizationSwitchService] Switching organization was refused:', error);
			this.notifyRefused(organization, error);
			return false;
		}

		if (!response?.token || !response?.user) {
			this.notifyRefused(organization);
			return false;
		}

		// The desktop timer tracks an employee (sign-in refuses a user without one). The API lets a member who is not an
		// active employee of the organization switch to it, and has already replaced the refresh token held so far, so
		// switch straight back to keep a working session in the organization the user was in.
		if (!response.user.employee) {
			await this.returnTo(currentOrganizationId);
			this._toastrNotificationService.error(
				this._translateService.instant('TIMER_TRACKER.TOASTR.ORGANIZATION_NOT_EMPLOYEE', {
					name: organization.name
				})
			);
			return false;
		}

		await this.apply(response, organization);
		return true;
	}

	/**
	 * Switch back to the organization the user was in after the API issued tokens for an organization the timer cannot
	 * track in. If that fails too, the tokens held before stay in place: the access token keeps working in that
	 * organization until it expires, and the user then signs in again.
	 */
	private async returnTo(organizationId: string | null): Promise<void> {
		if (!organizationId) {
			return;
		}
		try {
			const response = await firstValueFrom(this._authService.switchOrganization(organizationId));
			if (response?.token && response?.user?.employee) {
				await this.apply(
					response,
					this._store.selectedOrganization ?? this._store.user?.employee?.organization
				);
			}
		} catch (error) {
			console.error('[OrganizationSwitchService] Switching back to the previous organization failed:', error);
		}
	}

	/**
	 * Store the tokens and user the API issued for `organization` and make it the selected organization.
	 */
	private async apply(response: IAuthResponse, organization: IOrganization): Promise<void> {
		const { employee } = response.user;

		// The switch response carries the employee without its organization; the time tracker reads the organization's
		// settings (screenshots, inactivity, required fields) from it.
		const authResponse: IAuthResponse = {
			...response,
			user: {
				...response.user,
				employee: { ...employee, organization: employee.organization ?? organization }
			}
		};

		// Renderer store: tokens, token expiry, user, tenant and organization, exactly as the desktop sign-in stores them.
		this._authStrategy.storeAuthenticationData(authResponse);
		if (organization) {
			this._store.selectedOrganization = organization;
		}

		// `/user/me` is cached for 24 hours and still describes the employee of the organization just left.
		this._userOrganizationCacheService.clear();

		// Electron main process: the same `auth_success` the sign-in sends, so the stored tokens, organization and
		// employee (used by the timer, screenshots and offline sync) follow the switch.
		const electronAuthentication$ = this._authService.electronAuthentication(authResponse);
		if (electronAuthentication$) {
			await firstValueFrom(electronAuthentication$, { defaultValue: undefined });
		}

		if (this._electronService.ipcRenderer) {
			// The client, project, team and task picked so far belong to the organization just left.
			this._electronService.ipcRenderer.send('update_project_on', {
				projectId: null,
				taskId: null,
				organizationContactId: null,
				organizationTeamId: null
			});
			// Reload the time tracker (selectors, statuses, today's time, organization settings) for the new organization.
			this._electronService.ipcRenderer.send('refresh-timer');
		}
	}

	/**
	 * Tell the user the switch did not happen, with the API's reason when it gave one.
	 */
	private notifyRefused(organization: IOrganization, error?: unknown): void {
		this._toastrNotificationService.error(
			this._translateService.instant('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_REFUSED', {
				name: organization.name,
				reason: this.reasonOf(error)
			})
		);
	}

	private reasonOf(error: unknown): string {
		if (error instanceof HttpErrorResponse) {
			const message = error.error?.message;
			if (typeof message === 'string' && message) {
				return message;
			}
			return this._errorMapping.mapErrorMessage(error);
		}
		if (error instanceof Error && error.message) {
			return error.message;
		}
		return this._translateService.instant('TIMER_TRACKER.TOASTR.UNEXPECTED_ERROR');
	}
}
