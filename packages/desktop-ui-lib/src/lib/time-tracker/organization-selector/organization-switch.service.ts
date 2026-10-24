import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, filter, firstValueFrom, map, Observable, of, timeout } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { AuthStrategy } from '../../auth/services/auth-strategy.service';
import { SessionExpiredHandler } from '../../auth/services/session-expired-handler.service';
import { ElectronService } from '../../electron/services';
import { ErrorMapping } from '../../services/error-mapping.service';
import { Store } from '../../services/store.service';
import { ToastrNotificationService } from '../../services/toastr-notification.service';
import { UserOrganizationCacheService } from '../../services/user-organization-cache.service';
import { ClientSelectorService } from '../../shared/features/client-selector/+state/client-selector.service';
import { ProjectSelectorService } from '../../shared/features/project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../../shared/features/task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../shared/features/team-selector/+state/team-selector.service';
import { TimeTrackerQuery } from '../+state/time-tracker.query';
import { TimeTrackerStore } from '../+state/time-tracker.store';

/**
 * How long a switch waits for the time tracker to finish reloading the organization switched to. Past that the switch
 * lock is released anyway, so a time tracker that never answers cannot keep the timer from starting for good.
 */
export const TIMER_RELOAD_TIMEOUT = 60 * 1000;

/**
 * Moves the desktop timer to another organization of the user's tenant.
 *
 * The API confines a non-admin to the organization named in their access token (ever-co/ever-gauzy#11316), so
 * changing the selected organization locally is not enough: every list would come back empty and every write would be
 * refused. Like the Gauzy web UI (`OrganizationContextService` in `@gauzy/ui-core/core`), this calls
 * `POST /auth/switch-organization` first, and only once the API has issued tokens for the new organization does it
 * store them (renderer store and Electron main process, the way the desktop sign-in does) and move the selection.
 * When the API refuses, nothing changes and the user is told why.
 *
 * A switch holds a lock (`isSwitching`) from the request until the time tracker has loaded the new organization; the
 * time tracker starts no timer meanwhile (Start button, tray, remote timer), since that timer would run with the
 * employee and tokens of the organization being left.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationSwitchService {
	private readonly _isSwitching$ = new BehaviorSubject<boolean>(false);

	/** Emits `true` while a switch is under way, `false` once it is over. */
	public readonly isSwitching$: Observable<boolean> = this._isSwitching$.asObservable();

	constructor(
		private readonly _authService: AuthService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _store: Store,
		private readonly _electronService: ElectronService,
		private readonly _userOrganizationCacheService: UserOrganizationCacheService,
		private readonly _toastrNotificationService: ToastrNotificationService,
		private readonly _translateService: TranslateService,
		private readonly _errorMapping: ErrorMapping,
		private readonly _sessionExpiredHandler: SessionExpiredHandler,
		private readonly _clientSelectorService: ClientSelectorService,
		private readonly _projectSelectorService: ProjectSelectorService,
		private readonly _teamSelectorService: TeamSelectorService,
		private readonly _taskSelectorService: TaskSelectorService,
		private readonly _timeTrackerStore: TimeTrackerStore,
		private readonly _timeTrackerQuery: TimeTrackerQuery
	) {}

	/**
	 * True from the moment the API is asked to switch until the time tracker has loaded the organization switched to (or
	 * the switch has failed). No timer may start meanwhile.
	 */
	public get isSwitching(): boolean {
		return this._isSwitching$.getValue();
	}

	/**
	 * Switch the timer to `organization`.
	 *
	 * @param organization The organization the user picked.
	 * @returns `true` when the timer now works in `organization`; `false` when the switch was refused or failed, in
	 * which case the timer still works in the organization it was in before (or, if not even switching back worked, the
	 * user has been sent to sign in again).
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

		// One switch at a time; the selector is disabled during a switch anyway.
		if (this.isSwitching) {
			return false;
		}

		this._isSwitching$.next(true);
		try {
			return await this.switchFrom(currentOrganizationId, organization);
		} finally {
			this._isSwitching$.next(false);
		}
	}

	private async switchFrom(currentOrganizationId: string | null, organization: IOrganization): Promise<boolean> {
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
		// active employee of the organization switch to it, and has already made that organization the user's last one
		// and replaced the refresh token held so far, so switch straight back to keep a working session in the
		// organization the user was in.
		if (!response.user.employee) {
			if (!(await this.returnTo(currentOrganizationId))) {
				// Not even that worked: a later token refresh would carry the session into the organization just
				// refused, where the timer has no employee to track. End the session through the usual sign-in instead
				// of letting the timer go on with tokens that are about to stop working.
				this._toastrNotificationService.error(
					this._translateService.instant('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_BACK_FAILED', {
						name: organization.name
					})
				);
				await firstValueFrom(this._sessionExpiredHandler.execute(), { defaultValue: undefined });
				return false;
			}
			this._toastrNotificationService.error(
				this._translateService.instant('TIMER_TRACKER.TOASTR.ORGANIZATION_NOT_EMPLOYEE', {
					name: organization.name
				})
			);
			return false;
		}

		await this.enter(response, organization);
		return true;
	}

	/**
	 * Switch back to the organization the user was in after the API issued tokens for an organization the timer cannot
	 * track in. Only the tokens change: the organization, and the client, project, team and task picked in it, stay.
	 *
	 * @returns `true` when the API switched back and its tokens are stored; `false` when the request failed or its answer
	 * cannot be used, in which case nothing was stored.
	 */
	private async returnTo(organizationId: string | null): Promise<boolean> {
		if (!organizationId) {
			return false;
		}
		try {
			const response = await firstValueFrom(this._authService.switchOrganization(organizationId));
			if (!response?.token || !response?.user?.employee) {
				console.error(
					'[OrganizationSwitchService] Switching back to the previous organization gave no usable answer'
				);
				return false;
			}
			await this.storeAuthentication(
				response,
				this._store.selectedOrganization ?? this._store.user?.employee?.organization
			);
			return true;
		} catch (error) {
			console.error('[OrganizationSwitchService] Switching back to the previous organization failed:', error);
			return false;
		}
	}

	/**
	 * Make `organization`, which the API has just issued `response` for, the one the timer works in: store the tokens,
	 * drop the work picked in the organization left, and reload the time tracker.
	 */
	private async enter(response: IAuthResponse, organization: IOrganization): Promise<void> {
		await this.storeAuthentication(response, organization);
		this.resetWorkSelection();
		await this.reloadTimeTracker();
	}

	/**
	 * Store the tokens and user the API issued for `organization`, in the renderer store and in the Electron main
	 * process. Resolves once the main process has saved them.
	 */
	private async storeAuthentication(response: IAuthResponse, organization: IOrganization): Promise<void> {
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

		// Electron main process: the same handler as the sign-in's `auth_success`, so the stored tokens, organization and
		// employee (used by the timer, screenshots and offline sync) follow the switch; but waited for, so nothing reads
		// the main process's account before it holds the new one.
		try {
			const saved$ = this._authService.electronAuthentication(authResponse, { waitUntilSaved: true });
			if (saved$) {
				await firstValueFrom(saved$, { defaultValue: undefined });
			}
		} catch (error) {
			console.error(
				'[OrganizationSwitchService] The Electron main process failed to save the new account:',
				error
			);
		}
	}

	/**
	 * Forget the client, project, team and task picked in the organization just left: in the Electron main process,
	 * which starts the timer with them, and in the four selectors, whose `load()` merges into the list already held
	 * (`updateInfiniteList`) and so would keep offering the old organization's items, and its page, next to the new ones.
	 */
	private resetWorkSelection(): void {
		this._electronService.ipcRenderer?.send('update_project_on', {
			projectId: null,
			taskId: null,
			organizationContactId: null,
			organizationTeamId: null
		});

		for (const selector of [
			this._clientSelectorService,
			this._projectSelectorService,
			this._teamSelectorService,
			this._taskSelectorService
		]) {
			selector.resetPage(); // data and page
			selector.selected = null;
		}
	}

	/**
	 * Reload the time tracker (selectors, statuses, today's time, organization settings) for the organization switched
	 * to, and wait until it is done: the time tracker clears `isRefreshing` once it has handled the `timer_tracker_show`
	 * that answers `refresh-timer`.
	 */
	private async reloadTimeTracker(): Promise<void> {
		const ipcRenderer = this._electronService.ipcRenderer;
		if (!ipcRenderer) {
			return;
		}

		this._timeTrackerStore.update({ isRefreshing: true });
		const reloaded = firstValueFrom(
			this._timeTrackerQuery.isRefreshing$.pipe(
				filter((isRefreshing) => !isRefreshing),
				map(() => true),
				timeout({ first: TIMER_RELOAD_TIMEOUT, with: () => of(false) })
			)
		);
		ipcRenderer.send('refresh-timer');

		if (!(await reloaded)) {
			console.warn(
				'[OrganizationSwitchService] The time tracker did not finish reloading the new organization in time'
			);
			this._timeTrackerStore.update({ isRefreshing: false });
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
