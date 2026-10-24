import { HttpErrorResponse } from '@angular/common/http';
import { IAuthResponse, IOrganization } from '@gauzy/contracts';
import { of, throwError } from 'rxjs';
import { OrganizationSwitchService } from './organization-switch.service';

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

	let authService: { switchOrganization: jest.Mock; electronAuthentication: jest.Mock };
	let authStrategy: { storeAuthenticationData: jest.Mock };
	let store: { organizationId: string | null; selectedOrganization: IOrganization | null; user: any };
	let ipcRenderer: { send: jest.Mock };
	let userOrganizationCache: { clear: jest.Mock };
	let toastr: { error: jest.Mock };
	let translate: { instant: jest.Mock };
	let errorMapping: { mapErrorMessage: jest.Mock };
	let service: OrganizationSwitchService;

	beforeEach(() => {
		authService = {
			switchOrganization: jest.fn(),
			electronAuthentication: jest.fn().mockReturnValue(of(undefined))
		};
		// Mirror AuthStrategy.storeAuthenticationData: the organization comes from the employee of the response.
		authStrategy = {
			storeAuthenticationData: jest.fn((response: IAuthResponse) => {
				store.organizationId = response.user.employee.organizationId;
				store.user = response.user;
			})
		};
		store = { organizationId: organizationA.id, selectedOrganization: organizationA, user: null };
		ipcRenderer = { send: jest.fn() };
		userOrganizationCache = { clear: jest.fn() };
		toastr = { error: jest.fn() };
		translate = {
			instant: jest.fn((key: string, params?: Record<string, string>) => `${key} ${JSON.stringify(params ?? {})}`)
		};
		errorMapping = { mapErrorMessage: jest.fn().mockReturnValue('mapped error') };

		service = new OrganizationSwitchService(
			authService as any,
			authStrategy as any,
			store as any,
			{ ipcRenderer } as any,
			userOrganizationCache as any,
			toastr as any,
			translate as any,
			errorMapping as any
		);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

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
		// The Electron main process receives the new tokens the way the sign-in sends them.
		expect(authService.electronAuthentication).toHaveBeenCalledWith(stored);
		expect(ipcRenderer.send).toHaveBeenCalledWith('update_project_on', {
			projectId: null,
			taskId: null,
			organizationContactId: null,
			organizationTeamId: null
		});
		expect(ipcRenderer.send).toHaveBeenCalledWith('refresh-timer');
		expect(toastr.error).not.toHaveBeenCalled();
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
		expect(store.organizationId).toBe(organizationA.id);
		expect(store.selectedOrganization).toBe(organizationA);
		expect(translate.instant).toHaveBeenCalledWith('TIMER_TRACKER.TOASTR.ORGANIZATION_NOT_EMPLOYEE', {
			name: organizationB.name
		});
		expect(toastr.error).toHaveBeenCalledTimes(1);
	});

	it('leaves the held tokens in place when switching back fails as well', async () => {
		authService.switchOrganization
			.mockReturnValueOnce(of(authResponse(organizationB.id, false)))
			.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

		await expect(service.switchOrganization(organizationB)).resolves.toBe(false);

		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(store.organizationId).toBe(organizationA.id);
		expect(store.selectedOrganization).toBe(organizationA);
		expect(toastr.error).toHaveBeenCalledTimes(1);
	});

	it('does nothing for a missing organization', async () => {
		await expect(service.switchOrganization(null)).resolves.toBe(false);
		expect(authService.switchOrganization).not.toHaveBeenCalled();
	});
});
