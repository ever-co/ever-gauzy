import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { AuthService } from '../auth/auth.service';
import { ToastrService } from '../notification/toastr.service';
import { OrganizationContextService } from './organization-context.service';

/**
 * The failure toasts of an organization switch are translation keys (so they follow the user's language) and carry
 * no hard-coded title: the toast service supplies the translated default one.
 */
describe('OrganizationContextService', () => {
	let service: OrganizationContextService;
	let store: Record<string, any>;
	let authService: { switchOrganization: jest.Mock };
	let toastr: { danger: jest.Mock };

	const target = { id: 'org-2', name: 'Second' } as IOrganization;

	beforeEach(() => {
		store = { selectedOrganization: { id: 'org-1' } };
		authService = { switchOrganization: jest.fn() };
		toastr = { danger: jest.fn() };
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		jest.spyOn(console, 'info').mockImplementation(() => undefined);

		TestBed.configureTestingModule({
			providers: [
				OrganizationContextService,
				{ provide: Store, useValue: store },
				{ provide: AuthService, useValue: authService },
				{ provide: ToastrService, useValue: toastr }
			]
		});
		service = TestBed.inject(OrganizationContextService);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the new tokens and organization on success without a toast', async () => {
		authService.switchOrganization.mockReturnValue(of({ token: 't', refresh_token: 'r', user: { id: 'u' } }));

		await expect(service.switchOrganization(target)).resolves.toBe(true);
		expect(store['token']).toBe('t');
		expect(store['selectedOrganization']).toBe(target);
		expect(toastr.danger).not.toHaveBeenCalled();
	});

	it('reports an empty answer with a translation key', async () => {
		authService.switchOrganization.mockReturnValue(of(null));

		await expect(service.switchOrganization(target)).resolves.toBe(false);
		expect(toastr.danger).toHaveBeenCalledWith('WORKSPACES.SWITCH.ORGANIZATION_FAILED');
	});

	it('reports an answer without a token with a translation key and keeps the current organization', async () => {
		authService.switchOrganization.mockReturnValue(of({ user: { id: 'u' } }));

		await expect(service.switchOrganization(target)).resolves.toBe(false);
		expect(toastr.danger).toHaveBeenCalledWith('WORKSPACES.SWITCH.ORGANIZATION_APPLY_FAILED');
		expect(store['selectedOrganization']).toEqual({ id: 'org-1' });
	});

	it('reports a failed request with a translation key', async () => {
		authService.switchOrganization.mockReturnValue(throwError(() => new Error('boom')));

		await expect(service.switchOrganization(target)).resolves.toBe(false);
		expect(toastr.danger).toHaveBeenCalledWith('WORKSPACES.SWITCH.ORGANIZATION_FAILED_TRY_AGAIN');
	});

	it('does nothing when already on the organization', async () => {
		await expect(service.switchOrganization({ id: 'org-1' } as IOrganization)).resolves.toBe(true);
		expect(authService.switchOrganization).not.toHaveBeenCalled();
	});
});
