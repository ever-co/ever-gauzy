import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService, Store } from '@gauzy/ui-core/core';
import { errorCodeOf, ProvisionConfirmComponent } from './provision-confirm.component';
import { EverConnectProvisionService, handoffKeyOf, isEverReturnUrl, ProvisionSummary } from './provision.service';

const PROVISION = 'p'.repeat(43);
const HANDOFF = 'h'.repeat(43);
const SIGN_IN = 's'.repeat(43);

const summary = (overrides: Partial<ProvisionSummary> = {}): ProvisionSummary => ({
	org_display_name: 'Acme',
	handle: 'acme',
	legal_name: 'Acme GmbH',
	email: 'owner@acme.example',
	first_name: 'Ada',
	last_name: 'Owner',
	creates: { workspace: true, organization: true, admin_account: true, employee: true, team: true },
	tier: 'starter',
	product_tenant_exists: false,
	return_to: 'https://app.ever.co/start/jobs/1',
	terms: [],
	expires_at: Date.now() + 600_000,
	...overrides
});

describe('ProvisionConfirmComponent', () => {
	const api = { summary: jest.fn(), create: jest.fn(), redeemSignIn: jest.fn() };
	const auth = { signinWorkspaceByToken: jest.fn() };
	const store: Record<string, unknown> = {};
	const router = { navigateByUrl: jest.fn() };
	let assign: jest.SpyInstance | null = null;

	function create(queryParams: Record<string, string>) {
		TestBed.configureTestingModule({
			imports: [ProvisionConfirmComponent],
			providers: [
				{ provide: EverConnectProvisionService, useValue: api },
				{ provide: AuthService, useValue: auth },
				{ provide: Store, useValue: store },
				{ provide: Router, useValue: router },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParams } } }
			]
		});
		const component = TestBed.createComponent(ProvisionConfirmComponent).componentInstance;
		component.ngOnInit();
		return component;
	}

	beforeEach(() => {
		jest.clearAllMocks();
		for (const key of Object.keys(store)) delete store[key];
	});

	afterEach(() => assign?.mockRestore());

	it('ready: shows the summary from the API (the URL holds the two keys only)', () => {
		api.summary.mockReturnValue(of(summary()));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		expect(api.summary).toHaveBeenCalledWith(PROVISION, HANDOFF);
		expect(component.summary?.email).toBe('owner@acme.example');
		expect(component.firstName).toBe('Ada');
		expect(component.returnTo).toBe('https://app.ever.co/start/jobs/1');
		expect(component.error).toBeNull();
	});

	it('mismatch: another Ever ID than the one that started it', () => {
		api.summary.mockReturnValue(throwError(() => ({ status: 401, error: { code: 'identity_mismatch' } })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		expect(component.error).toBe('identity_mismatch');
		expect(component.retryable).toBe(false);
	});

	it('expired request: start again from Ever', () => {
		api.summary.mockReturnValue(throwError(() => ({ status: 401, error: { code: 'intent_expired' } })));
		expect(create({ provision: PROVISION, handoff: HANDOFF }).error).toBe('intent_expired');
	});

	it('a plan that does not include it: back to Ever', () => {
		api.summary.mockReturnValue(throwError(() => ({ status: 422, error: { code: 'validation_failed' } })));
		expect(create({ provision: PROVISION, handoff: HANDOFF }).error).toBe('validation_failed');
	});

	it('missing keys: nothing is asked', () => {
		expect(create({}).error).toBe('intent_invalid');
		expect(api.summary).not.toHaveBeenCalled();
	});

	it('success: creates with the names typed, signs in through the workspace sign-in, then goes back to Ever', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValue(
			of({
				status: 'created',
				product_tenant_id: 't',
				product_org_id: 'o',
				product_user_id: 'u',
				sign_in_url: `https://app.gauzy.test/#/auth/ever-id?handoff=${SIGN_IN}`,
				return_to: 'https://app.ever.co/start/jobs/1'
			})
		);
		api.redeemSignIn.mockReturnValue(
			of({
				kind: 'workspaces',
				response: {
					workspaces: [{ token: 'workspace-token', user: { id: 'u' } }],
					confirmed_email: 'owner@acme.example',
					total_workspaces: 1,
					show_popup: false
				}
			})
		);
		auth.signinWorkspaceByToken.mockReturnValue(
			of({
				user: { id: 'u', tenantId: 't', employee: { organizationId: 'o' } },
				token: 'access',
				refresh_token: 'refresh'
			})
		);
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		assign = jest.spyOn(component as never, 'goTo' as never).mockImplementation((() => undefined) as never);
		component.firstName = ' Ada ';
		component.lastName = 'Lovelace';
		component.create();
		expect(api.create).toHaveBeenCalledWith(PROVISION, HANDOFF, { first_name: 'Ada', last_name: 'Lovelace' });
		expect(api.redeemSignIn).toHaveBeenCalledWith(SIGN_IN);
		expect(auth.signinWorkspaceByToken).toHaveBeenCalledWith({
			email: 'owner@acme.example',
			token: 'workspace-token'
		});
		expect(store).toMatchObject({
			userId: 'u',
			token: 'access',
			refresh_token: 'refresh',
			tenantId: 't',
			organizationId: 'o'
		});
		expect(assign).toHaveBeenCalledWith('https://app.ever.co/start/jobs/1');
		expect(component.result?.status).toBe('created');
	});

	const created = (overrides: Record<string, unknown> = {}) => ({
		status: 'created',
		product_tenant_id: 't',
		product_org_id: 'o',
		product_user_id: 'u',
		sign_in_url: `https://app.gauzy.test/#/auth/ever-id?handoff=${SIGN_IN}`,
		return_to: 'https://app.ever.co/start/jobs/1',
		...overrides
	});

	it('a failed creation can be tried again, and the retry creates it', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValueOnce(throwError(() => ({ status: 500, error: { code: 'provisioning_failed' } })));
		api.create.mockReturnValueOnce(of(created({ sign_in_url: null })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		component.create();
		expect(component.error).toBe('provisioning_failed');
		expect(component.retryable).toBe(true);
		expect(component.busy).toBe(false);
		component.create();
		expect(api.create).toHaveBeenCalledTimes(2);
		expect(component.error).toBeNull();
		expect(component.result?.status).toBe('created');
	});

	it('no sign-in key in the answer: the page offers the login page, it never waits', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValue(of(created({ sign_in_url: null })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		component.create();
		expect(component.openUrl).toBe('#/auth/login');
		expect(api.redeemSignIn).not.toHaveBeenCalled();
	});

	it('the sign-in key cannot be redeemed: the login page, no navigation', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValue(of(created()));
		api.redeemSignIn.mockReturnValue(throwError(() => ({ status: 410 })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		assign = jest.spyOn(component as never, 'goTo' as never).mockImplementation((() => undefined) as never);
		component.create();
		expect(component.openUrl).toBe('#/auth/login');
		expect(assign).not.toHaveBeenCalled();
		expect(router.navigateByUrl).not.toHaveBeenCalled();
	});

	it('a return address off Ever in the answer is never followed', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValue(of(created({ return_to: 'https://evil.test/start' })));
		api.redeemSignIn.mockReturnValue(
			of({
				kind: 'workspaces',
				response: {
					workspaces: [{ token: 'w', user: { id: 'u' } }],
					confirmed_email: 'e',
					total_workspaces: 1,
					show_popup: false
				}
			})
		);
		auth.signinWorkspaceByToken.mockReturnValue(
			of({ user: { id: 'u', tenantId: 't' }, token: 'a', refresh_token: 'r' })
		);
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		assign = jest.spyOn(component as never, 'goTo' as never).mockImplementation((() => undefined) as never);
		component.create();
		expect(component.returnTo).toBe('https://app.ever.co/start/jobs/1');
		expect(assign).toHaveBeenCalledWith('https://app.ever.co/start/jobs/1');
	});

	it('one creation at a time', () => {
		api.summary.mockReturnValue(of(summary()));
		api.create.mockReturnValue(new Subject());
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		component.create();
		component.create();
		expect(api.create).toHaveBeenCalledTimes(1);
	});

	it('the documents to accept: echoed back as claims once accepted', () => {
		const document = {
			documentId: 'tos:gauzy',
			version: '1.0.0',
			sha256: 'a'.repeat(64),
			locale: 'en',
			url: 'https://app.gauzy.test/#/legal/terms',
			title: 'Terms'
		};
		api.summary.mockReturnValue(of(summary({ terms: [document] })));
		api.create.mockReturnValue(of(created({ sign_in_url: null })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		component.termsAccepted = true;
		component.create();
		expect(api.create).toHaveBeenCalledWith(PROVISION, HANDOFF, {
			first_name: 'Ada',
			last_name: 'Owner',
			terms: [{ documentId: 'tos:gauzy', version: '1.0.0', sha256: 'a'.repeat(64), locale: 'en' }]
		});
	});

	it('documents not accepted (422 terms_required): the form stays, to accept them and create again', () => {
		const document = {
			documentId: 'tos:gauzy',
			version: '1.0.0',
			sha256: 'a'.repeat(64),
			locale: 'en',
			url: 'https://app.gauzy.test/#/legal/terms',
			title: 'Terms'
		};
		api.summary.mockReturnValue(of(summary({ terms: [document] })));
		api.create.mockReturnValueOnce(throwError(() => ({ status: 422, error: { code: 'terms_required' } })));
		api.create.mockReturnValueOnce(of(created({ sign_in_url: null })));
		const component = create({ provision: PROVISION, handoff: HANDOFF });
		component.create();
		expect(component.error).toBe('terms_required');
		expect(component.summary).not.toBeNull();
		expect(component.result).toBeNull();
		component.termsAccepted = true;
		component.create();
		expect(api.create).toHaveBeenCalledTimes(2);
		expect(api.create).toHaveBeenLastCalledWith(PROVISION, HANDOFF, {
			first_name: 'Ada',
			last_name: 'Owner',
			terms: [{ documentId: 'tos:gauzy', version: '1.0.0', sha256: 'a'.repeat(64), locale: 'en' }]
		});
		expect(component.result?.status).toBe('created');
	});

	it('a summary that fails still offers the way back to Ever', () => {
		api.summary.mockReturnValue(throwError(() => ({ status: 401, error: { code: 'intent_expired' } })));
		expect(create({ provision: PROVISION, handoff: HANDOFF }).returnTo).toBe('https://app.ever.co');
	});

	it('helpers: only known codes, only pages of Ever, only a well-formed sign-in key', () => {
		expect(errorCodeOf({ status: 404 })).toBe('not_found');
		expect(errorCodeOf({ status: 401, error: { code: '<script>' } })).toBe('generic');
		expect(isEverReturnUrl('https://app-dev.ever.co/start')).toBe(true);
		expect(isEverReturnUrl('https://evil.test/start')).toBe(false);
		expect(isEverReturnUrl('https://user:pw@app.ever.co/')).toBe(false);
		expect(isEverReturnUrl('http://localhost:3030/start')).toBe(true);
		expect(isEverReturnUrl('javascript:alert(1)')).toBe(false);
		expect(handoffKeyOf(`https://app.gauzy.test/#/auth/ever-id?handoff=${SIGN_IN}`)).toBe(SIGN_IN);
		expect(handoffKeyOf('https://app.gauzy.test/#/auth/ever-id?handoff=<x>')).toBeNull();
		expect(handoffKeyOf(null)).toBeNull();
	});
});
