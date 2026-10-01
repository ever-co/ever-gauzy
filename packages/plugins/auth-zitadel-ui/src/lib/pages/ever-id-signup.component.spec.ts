import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '@gauzy/ui-core/core';
import { AuthZitadelUiService } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService } from '../services/ever-id-sign-in.service';
import { EverIdSignupComponent } from './ever-id-signup.component';

describe('EverIdSignupComponent', () => {
	const api = {
		signupDetails: jest.fn(),
		signup: jest.fn()
	};
	const signIn = { signIn: jest.fn(() => of({})) };
	const terms = { getRequiredTermsDocuments: jest.fn() };

	function create(handoff = 'k'.repeat(43)) {
		TestBed.configureTestingModule({
			imports: [EverIdSignupComponent],
			providers: [
				{ provide: AuthZitadelUiService, useValue: api },
				{ provide: EverIdSignInService, useValue: signIn },
				{ provide: AuthService, useValue: terms },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: { handoff } } } }
			]
		});
		const component = TestBed.createComponent(EverIdSignupComponent).componentInstance;
		component.ngOnInit();
		return component;
	}

	beforeEach(() => {
		jest.clearAllMocks();
		api.signupDetails.mockReturnValue(of({ email: 'new.person@example.test', firstName: 'New', lastName: 'Person' }));
		terms.getRequiredTermsDocuments.mockReturnValue(of([{ documentId: 'tos:gauzy', version: '1', sha256: 'a'.repeat(64), locale: 'en' }]));
	});

	it('prefills the verified details fetched with the one-time key', () => {
		const component = create();
		expect(api.signupDetails).toHaveBeenCalledWith('k'.repeat(43));
		expect(component.details.email).toBe('new.person@example.test');
		expect(component.firstName).toBe('New');
	});

	it('keeps the button disabled until the person confirms and accepts the terms', () => {
		const component = create();
		expect(component.canSubmit()).toBe(false);
		component.confirmed = true;
		expect(component.canSubmit()).toBe(false);
		component.termsAccepted = true;
		expect(component.canSubmit()).toBe(true);
	});

	it('sends the confirmation and the accepted documents, never the e-mail address', () => {
		api.signup.mockReturnValue(of({ workspaces: [{ token: 't', user: { id: 'u' } }], total_workspaces: 1, confirmed_email: 'new.person@example.test', show_popup: false }));
		const component = create();
		component.confirmed = true;
		component.termsAccepted = true;
		component.submit();
		const body = api.signup.mock.calls[0][0];
		expect(body).toEqual(expect.objectContaining({ handoff: 'k'.repeat(43), confirm: true, firstName: 'New', lastName: 'Person' }));
		expect(body.terms).toEqual([{ documentId: 'tos:gauzy', version: '1', sha256: 'a'.repeat(64), locale: 'en' }]);
		expect(JSON.stringify(body)).not.toContain('@');
		expect(signIn.signIn).toHaveBeenCalled();
	});

	it('shows the checkout when the API asks for a subscription', () => {
		api.signup.mockReturnValue(throwError(() => ({ status: 403, error: { code: 'subscription_required', checkoutUrl: 'https://checkout.example.test/' } })));
		const component = create();
		component.confirmed = true;
		component.termsAccepted = true;
		component.submit();
		expect(component.checkoutUrl).toBe('https://checkout.example.test/');
		expect(signIn.signIn).not.toHaveBeenCalled();
	});

	it('creates nothing while the required documents are unknown', () => {
		terms.getRequiredTermsDocuments.mockReturnValue(throwError(() => ({ status: 500 })));
		const component = create();
		component.confirmed = true;
		component.termsAccepted = true;
		expect(component.canSubmit()).toBe(false);
		expect(component.termsUnavailable).toBe(true);
		component.submit();
		expect(api.signup).not.toHaveBeenCalled();

		// The person can load them again without reloading the page.
		terms.getRequiredTermsDocuments.mockReturnValue(of([]));
		component.loadTerms();
		expect(component.termsUnavailable).toBe(false);
		expect(component.canSubmit()).toBe(true);
	});

	it('signs in once even when the workspace is also chosen by hand', () => {
		api.signup.mockReturnValue(of({ workspaces: [{ token: 't', user: { id: 'u' } }], total_workspaces: 1, confirmed_email: 'p@example.test', show_popup: false, redirect: '/pages/tasks' }));
		signIn.signIn.mockReturnValue(new Subject<never>() as never);
		const component = create();
		component.confirmed = true;
		component.termsAccepted = true;
		component.submit();
		component.signIn({ token: 't', user: { id: 'u' } } as never);
		expect(signIn.signIn).toHaveBeenCalledTimes(1);
		expect(signIn.signIn).toHaveBeenCalledWith('p@example.test', expect.anything(), '/pages/tasks');
	});

	it('treats a used key as expired', () => {
		api.signupDetails.mockReturnValue(throwError(() => ({ status: 410 })));
		expect(create().expired).toBe(true);
	});

	it('treats a missing key as expired without a request', () => {
		expect(create('').expired).toBe(true);
		expect(api.signupDetails).not.toHaveBeenCalled();
	});
});
