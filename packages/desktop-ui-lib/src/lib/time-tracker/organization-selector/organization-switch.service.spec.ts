import { HttpErrorResponse } from '@angular/common/http';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { OrganizationSwitchService, TIMER_RELOAD_TIMEOUT } from './organization-switch.service';

/**
 * ever-co/ever-gauzy#11316 confines a non-admin to the organization of their access token, so picking another
 * organization in the desktop timer must go through `POST /auth/switch-organization` and keep the tokens it returns.
 * The collaborators are plain stubs: the service is constructed directly, no TestBed.
 */
describe('OrganizationSwitchService', () => {
	const organizationA = { id: 'org-a', name: 'Org A' } as IOrganization;
	const organizationB = { id: 'org-b', name: 'Org B' } as IOrganization;

	const authResponse = (organizationId: string, withEmployee = true): IAuthResponse =>
		({
			token: `access-${organizationId}`,
			refresh_token: `refresh-${organizationId}`,
			user: {
				id: 'user-1',
				tenantId: 'tenant-1',
				...(withEmployee && { employee: { id: `employee-${organizationId}`, organizationId } })
			}
		}) as IAuthResponse;

	type SelectorStub = { resetPage: jest.Mock; selected: unknown };
	const selectorStub = (): SelectorStub => ({ resetPage: jest.fn(), selected: { id: 'picked-in-org-a' } });

	let authService: { switchOrganization: jest.Mock; electronAuthentication: jest.Mock };
	let authStrategy: { storeAuthenticationData: jest.Mock; replaceCredentials: jest.Mock };
	/** True while `AuthStrategy.replaceCredentials` runs (no token refresh may overlap it). */
	let replacingCredentials: boolean;
	let store: { organizationId: string | null; selectedOrganization: IOrganization | null; user: any };
	let ipcRenderer: { send: jest.Mock };
	let userOrganizationCache: { clear: jest.Mock };
	let toastr: { error: jest.Mock };
	let translate: { instant: jest.Mock };
	let errorMapping: { mapErrorMessage: jest.Mock };
	let sessionExpiredHandler: { execute: jest.Mock };
	let selectors: { client: SelectorStub; project: SelectorStub; team: SelectorStub; task: SelectorStub };
	let isRefreshing$: BehaviorSubject<boolean>;
	let timeTrackerStore: { update: jest.Mock };
	let service: OrganizationSwitchService;

	/** The channels sent to the Electron main process, in order. */
	const sentChannels = (): string[] => ipcRenderer.send.mock.calls.map(([channel]) => channel);

	beforeEach(() => {
		authService = {
			switchOrganization: jest.fn(),
			electronAuthentication: jest.fn().mockReturnValue(of(undefined))
		};
		// Mirror AuthStrategy.storeAuthenticationData: the organization comes from the employee of the response.
		replacingCredentials = false;
		authStrategy = {
			storeAuthenticationData: jest.fn((response: IAuthResponse) => {
				store.organizationId = response.user.employee.organizationId;
				store.user = response.user;
			}),
			replaceCredentials: jest.fn(async (operation: () => Promise<unknown>) => {
				replacingCredentials = true;
				try {
					return await operation();
				} finally {
					replacingCredentials = false;
				}
			})
		};
		store = { organizationId: organizationA.id, selectedOrganization: organizationA, user: null };
		// Mirror the time tracker: `refresh-timer` makes the main process answer `timer_tracker_show`, after whose
		// reload the time tracker clears `isRefreshing`.
		ipcRenderer = {
			send: jest.fn((channel: string) => {
				if (channel === 'refresh-timer') {
					isRefreshing$.next(false);
				}
			})
		};
		userOrganizationCache = { clear: jest.fn() };
		toastr = { error: jest.fn() };
		translate = {
			instant: jest.fn((key: string, params?: Record<string, string>) => `${key} ${JSON.stringify(params ?? {})}`)
		};
		errorMapping = { mapErrorMessage: jest.fn().mockReturnValue('mapped error') };
		sessionExpiredHandler = { execute: jest.fn().mockReturnValue(of(undefined)) };
		selectors = { client: selectorStub(), project: selectorStub(), team: selectorStub(), task: selectorStub() };
		isRefreshing$ = new BehaviorSubject(false);
		timeTrackerStore = {
			update: jest.fn((state: { isRefreshing?: boolean }) => isRefreshing$.next(state.isRefreshing))
		};

		service = new OrganizationSwitchService(
			authService as any,
			authStrategy as any,
			store as any,
			{ ipcRenderer } as any,
			userOrganizationCache as any,
			toastr as any,
			translate as any,
			errorMapping as any,
			sessionExpiredHandler as any,
			selectors.client as any,
			selectors.project as any,
			selectors.team as any,
			selectors.task as any,
			timeTrackerStore as any,
			{ isRefreshing$: isRefreshing$.asObservable() } as any
		);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('asks the API to switch, then stores the new tokens and selects the organization', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(true);

		expect(authService.switchOrganization).toHaveBeenCalledWith(organizationB.id);
		const stored: IAuthResponse = authStrategy.storeAuthenticationData.mock.calls[0][0];
		expect(stored.token).toBe('access-org-b');
		expect(stored.refresh_token).toBe('refresh-org-b');
		// The switch response has no employee.organization; the picked organization fills it in.
		expect(stored.user.employee.organization).toBe(organizationB);
		expect(store.organizationId).toBe(organizationB.id);
		expect(store.selectedOrganization).toBe(organizationB);
		expect(userOrganizationCache.clear).toHaveBeenCalled();
		// The Electron main process receives the new tokens through the handler the sign-in uses, and is waited for.
		expect(authService.electronAuthentication).toHaveBeenCalledWith(stored, { waitUntilSaved: true });
		expect(ipcRenderer.send).toHaveBeenCalledWith('update_project_on', {
			projectId: null,
			taskId: null,
			organizationContactId: null,
			organizationTeamId: null
		});
		expect(sentChannels()).toEqual(['update_project_on', 'refresh-timer']);
		expect(toastr.error).not.toHaveBeenCalled();
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();
	});

	it('reloads the timer only once the main process has saved the new account', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		const saved$ = new Subject<void>();
		authService.electronAuthentication.mockReturnValue(saved$);

		const switching = service.switchOrganization(organizationB);
		await new Promise((resolve) => setTimeout(resolve, 0));

		// The renderer holds the new tokens, but nothing reads the main process's account before it is saved.
		expect(store.organizationId).toBe(organizationB.id);
		expect(ipcRenderer.send).not.toHaveBeenCalled();
		expect(service.isSwitching).toBe(true);

		saved$.next();
		saved$.complete();

		await expect(switching).resolves.toBe(true);
		expect(sentChannels()).toEqual(['update_project_on', 'refresh-timer']);
	});

	it('sends the user to sign in again when the main process fails to save the new account', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		authService.electronAuthentication.mockReturnValue(throwError(() => new Error('GET_EMP_SETTING')));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		// Renderer and main process disagree now: no reset, no reload, but a clean sign-in.
		expect(ipcRenderer.send).not.toHaveBeenCalled();
		for (const selector of Object.values(selectors)) {
			expect(selector.resetPage).not.toHaveBeenCalled();
		}
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_INCOMPLETE', {
			name: organizationB.name
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
		expect(service.isSwitching).toBe(false);
	});

	it('empties the four selectors (items, page and pick) before the timer loads the new organization', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		ipcRenderer.send.mockImplementation((channel: string) => {
			if (channel === 'refresh-timer') {
				// By the time the time tracker reloads, the old organization's items and picks are gone.
				for (const selector of Object.values(selectors)) {
					expect(selector.resetPage).toHaveBeenCalledTimes(1);
					expect(selector.selected).toBeNull();
				}
				isRefreshing$.next(false);
			}
		});

		await expect(service.switchOrganization(organizationB)).resolves.toBe(true);

		expect(sentChannels()).toContain('refresh-timer');
	});

	it('holds the switch lock until the time tracker has loaded the new organization', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		// The time tracker has not answered the refresh yet.
		ipcRenderer.send.mockImplementation(() => undefined);

		let settled = false;
		const switching = service.switchOrganization(organizationB).then((switched) => {
			settled = true;
			return switched;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(sentChannels()).toContain('refresh-timer');
		expect(timeTrackerStore.update).toHaveBeenCalledWith({ isRefreshing: true });
		expect(settled).toBe(false);
		expect(service.isSwitching).toBe(true);

		// The time tracker finished its reload.
		isRefreshing$.next(false);

		await expect(switching).resolves.toBe(true);
		expect(service.isSwitching).toBe(false);
	});

	it('refuses a second switch while one is under way', async () => {
		const response$ = new Subject<IAuthResponse>();
		authService.switchOrganization.mockReturnValue(response$);

		const first = service.switchOrganization(organizationB);
		await expect(service.switchOrganization({ id: 'org-c', name: 'Org C' } as IOrganization)).resolves.toBe(false);
		expect(authService.switchOrganization).toHaveBeenCalledTimes(1);

		response$.next(authResponse(organizationB.id));
		response$.complete();
		await expect(first).resolves.toBe(true);
	});

	it('keeps the old organization and tokens when the API refuses the switch, and shows its reason', async () => {
		const refusal = new HttpErrorResponse({
			status: 401,
			error: { statusCode: 401, message: 'User does not have access to this organization' }
		});
		authService.switchOrganization.mockReturnValue(throwError(() => refusal));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(authService.electronAuthentication).not.toHaveBeenCalled();
		expect(ipcRenderer.send).not.toHaveBeenCalled();
		expect(store.organizationId).toBe(organizationA.id);
		expect(store.selectedOrganization).toBe(organizationA);
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_REFUSED', {
			name: organizationB.name,
			reason: 'User does not have access to this organization'
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
		// A refusal is not an expired session.
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();
		expect(service.isSwitching).toBe(false);
	});

	it('falls back to the mapped HTTP error when the refusal carries no message (e.g. a 403 without body)', async () => {
		authService.switchOrganization.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(errorMapping.mapErrorMessage).toHaveBeenCalled();
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_REFUSED', {
			name: organizationB.name,
			reason: 'mapped error'
		});
		expect(store.organizationId).toBe(organizationA.id);
	});

	it('treats an empty answer as a refusal', async () => {
		authService.switchOrganization.mockReturnValue(of(null));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(store.organizationId).toBe(organizationA.id);
		expect(toastr.error).toHaveBeenCalledTimes(1);
	});

	it('does not call the API when the organization is already the one the token was issued for', async () => {
		await expect(service.switchOrganization(organizationA)).resolves.toBe(true);

		expect(authService.switchOrganization).not.toHaveBeenCalled();
		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
	});

	it('switches straight back when the user is not an active employee of the organization picked', async () => {
		authService.switchOrganization.mockImplementation((organizationId: string) =>
			of(authResponse(organizationId, organizationId === organizationA.id))
		);

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		// First the pick, then back to where the user was: the first call replaced the refresh token held before.
		expect(authService.switchOrganization.mock.calls.map(([id]) => id)).toEqual([
			organizationB.id,
			organizationA.id
		]);
		expect(authStrategy.storeAuthenticationData).toHaveBeenCalledTimes(1);
		const stored: IAuthResponse = authStrategy.storeAuthenticationData.mock.calls[0][0];
		expect(stored.token).toBe('access-org-a');
		expect(authService.electronAuthentication).toHaveBeenCalledWith(stored, { waitUntilSaved: true });
		expect(store.organizationId).toBe(organizationA.id);
		expect(store.selectedOrganization).toBe(organizationA);
		// Still the same organization: the client, project, team and task picked in it stay, and nothing reloads.
		expect(ipcRenderer.send).not.toHaveBeenCalled();
		for (const selector of Object.values(selectors)) {
			expect(selector.resetPage).not.toHaveBeenCalled();
			expect(selector.selected).toEqual({ id: 'picked-in-org-a' });
		}
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_NOT_EMPLOYEE', {
			name: organizationB.name
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();
	});

	it('sends the user to sign in again when switching back fails as well', async () => {
		authService.switchOrganization
			.mockReturnValueOnce(of(authResponse(organizationB.id, false)))
			.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(ipcRenderer.send).not.toHaveBeenCalled();
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_BACK_FAILED', {
			name: organizationB.name
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
		expect(service.isSwitching).toBe(false);
	});

	it('sends the user to sign in again when the main process fails to save the switch back', async () => {
		authService.switchOrganization.mockImplementation((organizationId: string) =>
			of(authResponse(organizationId, organizationId === organizationA.id))
		);
		authService.electronAuthentication.mockReturnValue(throwError(() => new Error('save failed')));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_BACK_FAILED', {
			name: organizationB.name
		});
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
	});

	it('sends the user to sign in again when switching back gives no employee either', async () => {
		authService.switchOrganization.mockImplementation((organizationId: string) =>
			of(authResponse(organizationId, false))
		);

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
	});

	it('asks the API and stores its tokens with no token refresh overlapping, and reloads only after that', async () => {
		authService.switchOrganization.mockImplementation((organizationId: string) => {
			expect(replacingCredentials).toBe(true);
			return of(authResponse(organizationId));
		});
		authStrategy.storeAuthenticationData.mockImplementation((response: IAuthResponse) => {
			expect(replacingCredentials).toBe(true);
			store.organizationId = response.user.employee.organizationId;
			store.user = response.user;
		});
		ipcRenderer.send.mockImplementation((channel: string) => {
			// The reload makes requests that may need a token refresh: it must not wait for the switch to let one go.
			expect(replacingCredentials).toBe(false);
			if (channel === 'refresh-timer') {
				isRefreshing$.next(false);
			}
		});

		await expect(service.switchOrganization(organizationB)).resolves.toBe(true);

		expect(authStrategy.replaceCredentials).toHaveBeenCalledTimes(1);
		expect(sentChannels()).toEqual(['update_project_on', 'refresh-timer']);
	});

	it('fails the switch, and sends the user to sign in again, when the time tracker does not reload in time', async () => {
		jest.useFakeTimers();
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		// The time tracker never answers the refresh.
		ipcRenderer.send.mockImplementation(() => undefined);

		const switching = service.switchOrganization(organizationB);
		await jest.advanceTimersByTimeAsync(TIMER_RELOAD_TIMEOUT - 1);

		// Until then no timer may start: the account is in organization B, the time tracker still in A.
		expect(service.isSwitching).toBe(true);
		expect(service.beginTimerStart()).toBeNull();
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		await expect(switching).resolves.toBe(false);
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_INCOMPLETE', {
			name: organizationB.name
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
		expect(timeTrackerStore.update).toHaveBeenLastCalledWith({ isRefreshing: false });
	});

	it('treats an account that could not even be handed to the main process as a failed save', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		// `electronAuthentication` returns nothing when the IPC call throws synchronously.
		authService.electronAuthentication.mockReturnValue(undefined);

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(ipcRenderer.send).not.toHaveBeenCalled();
		for (const selector of Object.values(selectors)) {
			expect(selector.resetPage).not.toHaveBeenCalled();
		}
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_SWITCH_INCOMPLETE', {
			name: organizationB.name
		});
		expect(sessionExpiredHandler.execute).toHaveBeenCalledTimes(1);
	});

	it('announces the organization entered after storing its tokens and before the time tracker reloads', async () => {
		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		const entered: Array<{ organization: IOrganization; organizationId: string | null; sent: string[] }> = [];
		service.organizationEntered$.subscribe((organization) =>
			entered.push({ organization, organizationId: store.organizationId, sent: sentChannels() })
		);

		await expect(service.switchOrganization(organizationB)).resolves.toBe(true);

		// The time tracker forgets organization A's screenshots then, so the reload cannot show them again.
		expect(entered).toEqual([
			{ organization: organizationB, organizationId: organizationB.id, sent: ['update_project_on'] }
		]);
	});

	it('announces no organization entered when the switch is refused or switched back', async () => {
		const entered = jest.fn();
		service.organizationEntered$.subscribe(entered);
		authService.switchOrganization.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		authService.switchOrganization.mockImplementation((organizationId: string) =>
			of(authResponse(organizationId, organizationId === organizationA.id))
		);
		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(entered).not.toHaveBeenCalled();
	});

	it('begins no switch while a timer start is under way', async () => {
		const starting: boolean[] = [];
		service.isStartingTimer$.subscribe((isStarting) => starting.push(isStarting));

		const endTimerStart = service.beginTimerStart();
		expect(endTimerStart).toEqual(expect.any(Function));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);
		expect(authService.switchOrganization).not.toHaveBeenCalled();
		expect(service.isSwitching).toBe(false);

		// Ending a start twice releases it once.
		endTimerStart();
		endTimerStart();
		expect(starting).toEqual([false, true, false]);

		authService.switchOrganization.mockReturnValue(of(authResponse(organizationB.id)));
		await expect(service.switchOrganization(organizationB)).resolves.toBe(true);
	});

	it('lets no timer start while a switch is under way, and lets it once the switch is over', async () => {
		const response$ = new Subject<IAuthResponse>();
		authService.switchOrganization.mockReturnValue(response$);

		const switching = service.switchOrganization(organizationB);
		expect(service.beginTimerStart()).toBeNull();

		response$.next(authResponse(organizationB.id));
		response$.complete();
		await expect(switching).resolves.toBe(true);

		const endTimerStart = service.beginTimerStart();
		expect(endTimerStart).toEqual(expect.any(Function));
		endTimerStart();
	});

	it('does nothing for a missing organization', async () => {
		await expect(service.switchOrganization(null)).resolves.toBe(false);
		expect(authService.switchOrganization).not.toHaveBeenCalled();
	});
});
