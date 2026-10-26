import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import {
	BehaviorSubject,
	distinctUntilChanged,
	filter,
	firstValueFrom,
	map,
	Observable,
	of,
	Subject,
	timeout
} from 'rxjs';
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
 * has failed: the account is in the new organization while the time tracker still holds the old one's employee,
 * settings and screenshots, so the user signs in again rather than track time with that mix.
 */
export const TIMER_RELOAD_TIMEOUT = 60 * 1000;

/** How the credentials part of a switch ended (`switchCredentials`). */
type CredentialsOutcome =
	/** The new organization's tokens are stored, in the renderer and in the Electron main process. */
	| 'entered'
	/** The API refused, or gave no usable answer; nothing changed, and the user has been told why. */
	| 'refused'
	/** No employee in the organization picked; the API switched back and its tokens are stored. */
	| 'not-employee'
	/** No employee in the organization picked, and switching back failed. */
	| 'switch-back-failed'
	/** The Electron main process failed to save the new organization's account. */
	| 'save-failed';

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
 * A switch and a timer start never overlap. A switch holds a lock (`isSwitching`) from the request until the time
 * tracker has loaded the new organization; the time tracker starts no timer meanwhile (Start button, tray, remote
 * timer), since that timer would run with the employee and tokens of the organization being left. A timer start holds
 * `beginTimerStart()` from its first step until the main process has started the timer; no switch begins meanwhile.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationSwitchService {
	private readonly _isSwitching$ = new BehaviorSubject<boolean>(false);
	private readonly _timerStarts$ = new BehaviorSubject<number>(0);
	private readonly _organizationEntered$ = new Subject<IOrganization>();

	/** Emits `true` while a switch is under way, `false` once it is over. */
	public readonly isSwitching$: Observable<boolean> = this._isSwitching$.asObservable();

	/** Emits `true` while a timer start is under way (`beginTimerStart()`); the organization selector is disabled then. */
	public readonly isStartingTimer$: Observable<boolean> = this._timerStarts$.pipe(
		map((count) => count > 0),
		distinctUntilChanged()
	);

	/**
	 * Emits the organization switched to once its tokens are stored and before the time tracker reloads: whatever the
	 * time tracker holds of the organization left and does not reload from scratch (its screenshots) must go then.
	 */
	public readonly organizationEntered$: Observable<IOrganization> = this._organizationEntered$.asObservable();

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
	 * Hold off organization switches while the timer starts. The time tracker calls this before the first step of a
	 * start (its preflight awaits the platform, the macOS permission prompt and today's time, which would leave room for
	 * a switch to begin) and calls the function returned once the main process has answered `START_TIMER`, or the start
	 * was given up.
	 *
	 * @returns The function that ends the hold, or `null` when a switch is under way: the timer must not start then.
	 */
	public beginTimerStart(): (() => void) | null {
		if (this.isSwitching) {
			return null;
		}
		this._timerStarts$.next(this._timerStarts$.getValue() + 1);
		let ended = false;
		return () => {
			if (!ended) {
				ended = true;
				this._timerStarts$.next(this._timerStarts$.getValue() - 1);
			}
		};
	}

	/**
	 * Switch the timer to `organization`.
	 *
	 * @param organization The organization the user picked.
	 * @returns `true` when the timer now works in `organization`; `false` when the switch was not begun (another one, or
	 * a timer start, is under way), was refused or failed, in which case the timer still works in the organization it was
	 * in before (or, when the two halves of the app could not be brought to agree on one, the user has been sent to sign
	 * in again).
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

		// One switch at a time, and none while the timer starts; the selector is disabled then anyway.
		if (this.isSwitching) {
			return false;
		}
		if (this._timerStarts$.getValue() > 0) {
			console.warn('[OrganizationSwitchService] Not switching organization: the timer is starting');
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
		// No token refresh overlaps the API call and the storing of what it issued: an answer for the organization left
		// would otherwise overwrite the new organization's tokens, or its refusal (the switch replaces the refresh token
		// held before) end the session.
		const outcome = await this._authStrategy.replaceCredentials(() =>
			this.switchCredentials(currentOrganizationId, organization)
		);

		switch (outcome) {
			case 'refused':
				return false;
			case 'not-employee':
				this._toastrNotificationService.error(
					this._translateService.instant('TIMER_TRACKER.TOASTR.ORGANIZATION_NOT_EMPLOYEE', {
						name: organization.name
					})
				);
				return false;
			case 'switch-back-failed':
				// A later token refresh would carry the session into the organization just refused, where the timer has
				// no employee to track. End the session through the usual sign-in instead of letting the timer go on
				// with tokens that are about to stop working.
				await this.endSession('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_BACK_FAILED', organization);
				return false;
			case 'save-failed':
				// The renderer holds the new organization's tokens, the Electron main process may hold the old ones or
				// none (the agent clears them when it cannot read the employee's settings), and the API has replaced the
				// refresh token held before: the two halves of the app can no longer be brought to agree. Sign in again.
				await this.endSession('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_INCOMPLETE', organization);
				return false;
		}

		// Drop the work picked in the organization left, and whatever else the time tracker holds of it, then reload.
		this.resetWorkSelection();
		this._organizationEntered$.next(organization);
		if (!(await this.reloadTimeTracker())) {
			// The account is in the new organization, the time tracker still in the old one (employee, screenshot and
			// inactivity settings). Starts stayed refused until now; sign in again rather than release them.
			await this.endSession('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_INCOMPLETE', organization);
			return false;
		}
		return true;
	}

	/**
	 * Ask the API to switch to `organization` and store the tokens it issues, in the renderer and in the Electron main
	 * process. Runs under `AuthStrategy.replaceCredentials`, so it must not wait for a token refresh.
	 */
	private async switchCredentials(
		currentOrganizationId: string | null,
		organization: IOrganization
	): Promise<CredentialsOutcome> {
		let response: IAuthResponse | null;
		try {
			response = await firstValueFrom(this._authService.switchOrganization(organization.id));
		} catch (error) {
			console.error('[OrganizationSwitchService] Switching organization was refused:', error);
			this.notifyRefused(organization, error);
			return 'refused';
		}

		if (!response?.token || !response?.user) {
			this.notifyRefused(organization);
			return 'refused';
		}

		// The desktop timer tracks an employee (sign-in refuses a user without one). The API lets a member who is not an
		// active employee of the organization switch to it, and has already made that organization the user's last one
		// and replaced the refresh token held so far, so switch straight back to keep a working session in the
		// organization the user was in.
		if (!response.user.employee) {
			return (await this.returnTo(currentOrganizationId)) ? 'not-employee' : 'switch-back-failed';
		}

		return (await this.storeAuthentication(response, organization)) ? 'entered' : 'save-failed';
	}

	/**
	 * End the session through the usual sign-in (`SessionExpiredHandler`), after telling the user why.
	 */
	private async endSession(messageKey: string, organization: IOrganization): Promise<void> {
		this._toastrNotificationService.error(this._translateService.instant(messageKey, { name: organization.name }));
		await firstValueFrom(this._sessionExpiredHandler.execute(), { defaultValue: undefined });
	}

	/**
	 * Switch back to the organization the user was in after the API issued tokens for an organization the timer cannot
	 * track in. Only the tokens change: the organization, and the client, project, team and task picked in it, stay.
	 *
	 * @returns `true` when the API switched back and its tokens are stored, in the renderer and in the Electron main
	 * process; `false` when the request failed, its answer cannot be used (nothing was stored then), or the main process
	 * failed to save it.
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
			return await this.storeAuthentication(
				response,
				this._store.selectedOrganization ?? this._store.user?.employee?.organization
			);
		} catch (error) {
			console.error('[OrganizationSwitchService] Switching back to the previous organization failed:', error);
			return false;
		}
	}

	/**
	 * Store the tokens and user the API issued for `organization`, in the renderer store and in the Electron main
	 * process. Resolves once the main process has saved them.
	 *
	 * @returns `false` when the main process failed to save them, or they could not even be handed to it (the
	 * renderer store holds them already).
	 */
	private async storeAuthentication(response: IAuthResponse, organization: IOrganization): Promise<boolean> {
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
			if (!saved$) {
				// `electronAuthentication` swallows a synchronous IPC failure and returns nothing: nothing was saved.
				throw new Error('The new account could not be handed to the Electron main process');
			}
			await firstValueFrom(saved$, { defaultValue: undefined });
			return true;
		} catch (error) {
			console.error(
				'[OrganizationSwitchService] The Electron main process failed to save the new account:',
				error
			);
			return false;
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
	 *
	 * @returns `false` when it did not finish within `TIMER_RELOAD_TIMEOUT`.
	 */
	private async reloadTimeTracker(): Promise<boolean> {
		const ipcRenderer = this._electronService.ipcRenderer;
		if (!ipcRenderer) {
			return true;
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
			console.error(
				'[OrganizationSwitchService] The time tracker did not finish reloading the new organization in time'
			);
			this._timeTrackerStore.update({ isRefreshing: false });
			return false;
		}
		return true;
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
