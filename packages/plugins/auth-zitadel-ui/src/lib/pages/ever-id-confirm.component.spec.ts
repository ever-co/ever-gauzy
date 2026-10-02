import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthZitadelUiService } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService } from '../services/ever-id-sign-in.service';
import { EverIdConfirmComponent } from './ever-id-confirm.component';

describe('EverIdConfirmComponent', () => {
	const api = { confirm: jest.fn() };
	const signIn = { signIn: jest.fn(() => of({})) };

	function create(handoff = 'h'.repeat(43)) {
		TestBed.configureTestingModule({
			imports: [EverIdConfirmComponent],
			providers: [
				{ provide: AuthZitadelUiService, useValue: api },
				{ provide: EverIdSignInService, useValue: signIn },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: { handoff } } } }
			]
		});
		const component = TestBed.createComponent(EverIdConfirmComponent).componentInstance;
		component.ngOnInit();
		return component;
	}

	beforeEach(() => {
		jest.clearAllMocks();
		api.confirm.mockReset();
	});

	it('signs in once the code is right and one workspace opens', () => {
		const workspace = { token: 't', user: { id: 'u' } };
		api.confirm.mockReturnValue(
			of({ workspaces: [workspace], total_workspaces: 1, confirmed_email: 'p@example.test', show_popup: false })
		);
		const component = create();
		component.code = ' ABC123 ';
		component.submit();
		expect(api.confirm).toHaveBeenCalledWith('h'.repeat(43), 'ABC123');
		expect(signIn.signIn).toHaveBeenCalledTimes(1);
	});

	it('asks for the code again after a wrong one', () => {
		api.confirm.mockReturnValue(throwError(() => ({ status: 401 })));
		const component = create();
		component.code = 'WRONG1';
		component.submit();
		expect(component.wrongCode).toBe(true);
		expect(component.expired).toBe(false);
	});

	it.each([
		['another attempt was using it', 409],
		['it was tried too often just now', 429]
	])('keeps the step open when %s', (_name, status) => {
		api.confirm.mockReturnValue(throwError(() => ({ status, error: { retryAfter: 2 } })));
		const component = create();
		component.code = 'ABC123';
		component.submit();
		expect(component.retryLater).toBe(true);
		expect(component.expired).toBe(false);
		expect(component.busy).toBe(false);
	});

	it('ends the step once the key is used up or expired', () => {
		api.confirm.mockReturnValue(throwError(() => ({ status: 410 })));
		const component = create();
		component.code = 'ABC123';
		component.submit();
		expect(component.expired).toBe(true);
	});
});
