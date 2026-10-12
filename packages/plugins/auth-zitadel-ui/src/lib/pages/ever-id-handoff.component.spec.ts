import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthZitadelUiService } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService, safeAppPath } from '../services/ever-id-sign-in.service';
import { EverIdHandoffComponent } from './ever-id-handoff.component';

describe('EverIdHandoffComponent', () => {
	const api = { redeemHandoff: jest.fn() };
	const signIn = { signIn: jest.fn(() => of({})) };

	function create(queryParams: Record<string, string>) {
		TestBed.configureTestingModule({
			imports: [EverIdHandoffComponent],
			providers: [
				{ provide: AuthZitadelUiService, useValue: api },
				{ provide: EverIdSignInService, useValue: signIn },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParams } } }
			]
		});
		const component = TestBed.createComponent(EverIdHandoffComponent).componentInstance;
		component.ngOnInit();
		return component;
	}

	const workspace = (id: string) => ({ token: `token-${id}`, user: { id, tenant: { name: `Tenant ${id}` } } });

	beforeEach(() => jest.clearAllMocks());

	it('signs in directly when the Ever ID opens one workspace', () => {
		api.redeemHandoff.mockReturnValue(
			of({ kind: 'workspaces', response: { workspaces: [workspace('a')], total_workspaces: 1, confirmed_email: 'p@example.test', show_popup: false, redirect: '/pages/tasks' } })
		);
		create({ handoff: 'h'.repeat(43) });
		expect(signIn.signIn).toHaveBeenCalledWith('p@example.test', workspace('a'), '/pages/tasks');
	});

	it('lists several workspaces and signs in to the chosen one', () => {
		api.redeemHandoff.mockReturnValue(
			of({ kind: 'workspaces', response: { workspaces: [workspace('a'), workspace('b')], total_workspaces: 2, confirmed_email: 'p@example.test', show_popup: true } })
		);
		const component = create({ handoff: 'h'.repeat(43) });
		expect(signIn.signIn).not.toHaveBeenCalled();
		component.signIn(workspace('b') as never);
		expect(signIn.signIn).toHaveBeenCalledWith('p@example.test', workspace('b'), undefined);
	});

	it('shows an expiry message for a used key', () => {
		api.redeemHandoff.mockReturnValue(throwError(() => ({ status: 410 })));
		expect(create({ handoff: 'h'.repeat(43) }).error).toBe('expired');
	});

	it('shows only known error codes from the URL', () => {
		expect(create({ error: 'email_unverified' }).error).toBe('email_unverified');
		expect(api.redeemHandoff).not.toHaveBeenCalled();
	});

	it('turns an unknown error code from the URL into the generic one', () => {
		expect(create({ error: '<script>alert(1)</script>' }).error).toBe('sign_in_failed');
		expect(api.redeemHandoff).not.toHaveBeenCalled();
	});

	it('opens only paths inside the web app after signing in', () => {
		expect(safeAppPath('/pages/dashboard')).toBe('/pages/dashboard');
		expect(safeAppPath('//evil.example.test')).toBe('/');
		expect(safeAppPath('https://evil.example.test')).toBe('/');
		expect(safeAppPath(undefined)).toBe('/');
	});
});
