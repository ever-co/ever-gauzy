import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NbDialogService, NbToggleComponent } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { OrganizationContactService, Store } from '@gauzy/ui-core/core';
import { CHECK_ON_EVER_PLATFORM_EXTENSION, CONTACT_VIEW_ACTIONS_SLOT } from '../../ever-connect-ui.plugin';
import { EverConnectIntegration, EverConnectUiService } from '../../services/ever-connect.service';
import { LookupOptionsComponent } from '../lookup-options/lookup-options.component';
import {
	CheckOnEverPlatformButtonComponent,
	lookupShown,
	vatSuggestion
} from './check-on-ever-platform-button.component';
import { CheckOnEverPlatformDialogComponent } from './check-on-ever-platform-dialog.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };
const CONTACT = {
	id: '99999999-2222-4333-8444-555555555555',
	organizationId: ORGANIZATION.id,
	primaryEmail: 'billing@client.example',
	contact: { country: 'bg', fiscalInformation: 'VAT: BG 123 456 789, registered in Sofia' }
};

/** The counterparty check's row of `GET /api/ever-connect/integrations`. */
function row(overrides: Partial<EverConnectIntegration> = {}): EverConnectIntegration {
	return {
		key: 'counterparty_lookup',
		name: 'Check contacts on Ever Platform',
		description: '',
		direction: 'outbound',
		instance_wide: false,
		app_ever_co_only: false,
		scope_version: 1,
		scope: [],
		revoke_effect: '',
		state: 'enabled',
		enabled: true,
		pending_remote_revoke: false,
		revoke_source: null,
		revoked_at: null,
		consent: null,
		policy: 'allowed',
		requires_feature: 'lookup',
		feature_on: true,
		options: { auto_check: false },
		...overrides
	};
}

/**
 * "Check on Ever Platform" on a contact: shown only while the check is enabled for the organization
 * with the feature granted; nothing is checked on open unless the automatic check is on; the browser
 * talks to this installation's API only.
 */
describe('CheckOnEverPlatformButtonComponent', () => {
	const api = { integrations: jest.fn(), lookup: jest.fn(), setLookupAutoCheck: jest.fn() };
	const contacts = { getById: jest.fn() };
	const dialogs = { open: jest.fn() };

	/** Renders the button on the page of `CONTACT`, with `ORGANIZATION` selected. */
	function render() {
		TestBed.configureTestingModule({
			imports: [CheckOnEverPlatformButtonComponent],
			providers: [
				{ provide: EverConnectUiService, useValue: api },
				{ provide: OrganizationContactService, useValue: contacts },
				{ provide: NbDialogService, useValue: dialogs },
				{
					provide: ActivatedRoute,
					useValue: { paramMap: new BehaviorSubject(convertToParamMap({ id: CONTACT.id })) }
				},
				{
					provide: Store,
					useValue: {
						selectedOrganization$: of(ORGANIZATION),
						user: { tenantId: 'tenant-1' },
						hasPermission: () => true
					}
				}
			]
		});
		const fixture = TestBed.createComponent(CheckOnEverPlatformButtonComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			el,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`)
		};
	}

	beforeEach(() => {
		jest.resetAllMocks();
		contacts.getById.mockResolvedValue(CONTACT);
		api.lookup.mockReturnValue(
			of({ items: [{ kind: 'email', status: 'match', handle: 'client-co', features: ['pay'] }] })
		);
	});

	it.each([
		['the module is not loaded (404)', () => throwError(() => ({ status: 404 }))],
		['the person may not see integrations (403)', () => throwError(() => ({ status: 403 }))],
		['the organization is not linked', () => of([row({ state: 'not_linked', enabled: false })])],
		['available, not enabled', () => of([row({ state: 'available', enabled: false })])],
		['disabled', () => of([row({ state: 'disabled', enabled: false })])],
		['revoked in app.ever.co', () => of([row({ state: 'revoked_remote', enabled: false })])],
		['denied by policy', () => of([row({ state: 'denied_by_policy', enabled: false })])],
		['coming soon', () => of([row({ state: 'coming_soon', enabled: false })])],
		['enabled, the feature not granted', () => of([row({ feature_on: false })])],
		['enabled, the feature unknown', () => of([row({ feature_on: null })])],
		['no such row', () => of([])]
	])('hidden when %s, and nothing is checked', (_label, answer) => {
		api.integrations.mockReturnValue(answer());
		const { find, component } = render();
		expect(component.visible).toBe(false);
		expect(find('check-on-ever-platform')).toBeNull();
		expect(api.lookup).not.toHaveBeenCalled();
		expect(contacts.getById).not.toHaveBeenCalled();
	});

	it('shown when enabled with the feature; with the automatic check off, nothing is checked or read on open', () => {
		api.integrations.mockReturnValue(of([row()]));
		const { find } = render();
		expect(api.integrations).toHaveBeenCalledWith(ORGANIZATION.id);
		expect(find('check-on-ever-platform')).not.toBeNull();
		expect(api.lookup).not.toHaveBeenCalled();
		expect(contacts.getById).not.toHaveBeenCalled();
	});

	it('with the automatic check on, the e-mail is checked once on open and a match is shown', async () => {
		api.integrations.mockReturnValue(of([row({ options: { auto_check: true } })]));
		const { fixture, find } = render();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(api.lookup).toHaveBeenCalledTimes(1);
		expect(api.lookup).toHaveBeenCalledWith(ORGANIZATION.id, [{ kind: 'email', value: CONTACT.primaryEmail }]);
		expect(find('auto-match')?.getAttribute('href')).toBe('https://ever.co/client-co');
	});

	it('the button opens the check, prefilled from the contact (the fiscal information as a VAT suggestion)', async () => {
		api.integrations.mockReturnValue(of([row()]));
		const { find, fixture } = render();
		(find('check-on-ever-platform') as HTMLButtonElement).click();
		await fixture.whenStable();
		expect(contacts.getById).toHaveBeenCalledWith(CONTACT.id, 'tenant-1', ['contact']);
		expect(dialogs.open).toHaveBeenCalledWith(CheckOnEverPlatformDialogComponent, {
			context: {
				organizationId: ORGANIZATION.id,
				email: CONTACT.primaryEmail,
				vat: 'BG 123 456 789',
				vatSuggested: true,
				country: 'BG'
			}
		});
		expect(api.lookup).not.toHaveBeenCalled();
	});

	it('a contact of another organization (the selector changed on the page) is not checked under this one', async () => {
		api.integrations.mockReturnValue(of([row()]));
		contacts.getById.mockResolvedValue({ ...CONTACT, organizationId: 'aaaaaaaa-2222-4333-8444-555555555555' });
		const { find, fixture } = render();
		(find('check-on-ever-platform') as HTMLButtonElement).click();
		await fixture.whenStable();
		expect(dialogs.open).not.toHaveBeenCalled();
		expect(api.lookup).not.toHaveBeenCalled();
	});

	it('lookupShown and vatSuggestion', () => {
		expect(lookupShown(row())).toBe(true);
		expect(lookupShown(row({ key: 'counterparty_discoverable' }))).toBe(false);
		expect(lookupShown(null)).toBe(false);
		expect(vatSuggestion('VAT: BG 123 456 789, registered in Sofia')).toBe('BG 123 456 789');
		expect(vatSuggestion('DE123456789')).toBe('DE123456789');
		expect(vatSuggestion('123456789')).toBe('123456789');
		expect(vatSuggestion('')).toBe('');
		expect(vatSuggestion('A long free text about the company that names no number at all')).toBe('');
	});

	it('is contributed to the contact page for people who may see integrations', () => {
		expect(CHECK_ON_EVER_PLATFORM_EXTENSION).toMatchObject({
			slotId: CONTACT_VIEW_ACTIONS_SLOT,
			permissions: [PermissionsEnum.INTEGRATION_VIEW]
		});
		expect(CONTACT_VIEW_ACTIONS_SLOT).toBe('contact-view-actions');
	});
});

describe('CheckOnEverPlatformDialogComponent', () => {
	const api = { lookup: jest.fn() };

	/** Renders the dialog with this context, as `NbDialogService` opens it. */
	function render(inputs: Partial<CheckOnEverPlatformDialogComponent> = {}) {
		TestBed.configureTestingModule({
			imports: [CheckOnEverPlatformDialogComponent],
			providers: [{ provide: EverConnectUiService, useValue: api }]
		});
		const fixture = TestBed.createComponent(CheckOnEverPlatformDialogComponent);
		// As NbDialogService does with the dialog's context: assigned onto the instance before it renders.
		Object.assign(fixture.componentInstance, { organizationId: ORGANIZATION.id, ...inputs });
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const find = (test: string) => el.querySelector(`[data-test="${test}"]`);
		return {
			fixture,
			el,
			find,
			field: (test: string) => find(test) as HTMLInputElement,
			/** Types into a field, as the browser does it. */
			type: (test: string, value: string) => {
				const input = find(test) as HTMLInputElement;
				input.value = value;
				input.dispatchEvent(new Event('input'));
				fixture.detectChanges();
			},
			/** The Check button. */
			check: () => {
				(find('check') as HTMLButtonElement).click();
				fixture.detectChanges();
			}
		};
	}

	beforeEach(() => jest.resetAllMocks());

	it('checks the identifiers entered (the country with the numbers) and shows each answer', () => {
		api.lookup.mockReturnValue(
			of({
				items: [
					{ kind: 'email', status: 'none' },
					{ kind: 'vat', status: 'match', handle: 'client-co', features: ['pay', 'invoice_exchange'] },
					{ kind: 'registration', status: 'cannot_be_checked', reason: 'no_country' }
				]
			})
		);
		const { check, field, find } = render({
			email: 'billing@client.example',
			vat: 'BG123456789',
			registration: '42',
			country: 'bg'
		});
		expect(field('email').value).toBe('billing@client.example');
		expect(field('vat').value).toBe('BG123456789');
		expect(field('registration').value).toBe('42');
		expect(field('country').value).toBe('bg');
		check();
		expect(api.lookup).toHaveBeenCalledWith(ORGANIZATION.id, [
			{ kind: 'email', value: 'billing@client.example' },
			{ kind: 'vat', value: 'BG123456789', country: 'BG' },
			{ kind: 'registration', value: '42', country: 'BG' }
		]);
		expect(find('none')).not.toBeNull();
		expect(find('handle')?.getAttribute('href')).toBe('https://ever.co/client-co');
		expect(find('handle')?.getAttribute('rel')).toBe('noopener noreferrer');
		expect(find('cannot-be-checked')).not.toBeNull();
	});

	it('what is typed in the fields is what is checked (the prefilled values can be edited)', () => {
		api.lookup.mockReturnValue(of({ items: [{ kind: 'vat', status: 'none' }] }));
		const { check, type } = render({ email: 'billing@client.example', vat: 'BG 123 456 789', country: 'BG' });
		type('email', '  ');
		type('vat', ' DE123456789 ');
		type('country', 'de');
		check();
		expect(api.lookup).toHaveBeenCalledWith(ORGANIZATION.id, [
			{ kind: 'vat', value: 'DE123456789', country: 'DE' }
		]);
	});

	it('nothing entered: the check cannot be started and nothing is checked', () => {
		const { check, find, type } = render();
		const button = () => find('check') as HTMLButtonElement;
		expect(button().disabled).toBe(true);
		check();
		expect(api.lookup).not.toHaveBeenCalled();
		type('registration', '42');
		expect(button().disabled).toBe(false);
		type('registration', ' ');
		expect(button().disabled).toBe(true);
	});

	it('too many checks: says when to try again', () => {
		api.lookup.mockReturnValue(
			throwError(() => ({ status: 429, error: { code: 'rate_limited' }, headers: { get: () => '17' } }))
		);
		const { check, find } = render({ email: 'a@b.example' });
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', {
			EVER_CONNECT: { LOOKUP: { ERRORS: { rate_limited: 'Try again in {{seconds}} s' } } }
		});
		translate.use('en');
		check();
		expect(find('error')?.textContent?.trim()).toBe('Try again in 17 s');
		expect(find('results')).toBeNull();
	});
});

describe('the check asks this installation only', () => {
	it('POST /api/ever-connect/lookup, and the setting PUT /api/ever-connect/integrations/counterparty_lookup/options', () => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		const service = TestBed.inject(EverConnectUiService);
		const http = TestBed.inject(HttpTestingController);
		service.lookup(ORGANIZATION.id, [{ kind: 'email', value: 'a@b.example' }]).subscribe();
		service.setLookupAutoCheck(ORGANIZATION.id, true).subscribe();
		const lookup = http.expectOne((req) => req.url === '/api/ever-connect/lookup');
		expect(lookup.request.method).toBe('POST');
		expect(lookup.request.params.get('organizationId')).toBe(ORGANIZATION.id);
		expect(lookup.request.body).toEqual({ items: [{ kind: 'email', value: 'a@b.example' }] });
		expect(lookup.request.urlWithParams).not.toContain('a@b.example');
		const options = http.expectOne(
			(req) => req.url === '/api/ever-connect/integrations/counterparty_lookup/options'
		);
		expect(options.request.method).toBe('PUT');
		expect(options.request.body).toEqual({ auto_check: true });
		http.verify();
	});
});

describe('LookupOptionsComponent', () => {
	const api = { setLookupAutoCheck: jest.fn() };

	/** Renders the setting with its saved value, for a person who may (or may not) change integrations. */
	function render(canEdit: boolean, autoCheck = false) {
		TestBed.configureTestingModule({
			imports: [LookupOptionsComponent],
			providers: [{ provide: EverConnectUiService, useValue: api }]
		});
		const fixture = TestBed.createComponent(LookupOptionsComponent);
		fixture.componentRef.setInput('organizationId', ORGANIZATION.id);
		fixture.componentRef.setInput('canEdit', canEdit);
		fixture.componentRef.setInput('autoCheck', autoCheck);
		const saved: boolean[] = [];
		fixture.componentInstance.autoCheckChange.subscribe((value) => saved.push(value));
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const checkbox = () => el.querySelector('[data-test="auto-check"] input[type="checkbox"]') as HTMLInputElement;
		const toggle = () =>
			fixture.debugElement.query(By.directive(NbToggleComponent)).componentInstance as NbToggleComponent;
		return {
			fixture,
			saved,
			checkbox,
			toggle,
			/** What the toggle shows: its native checkbox, which must agree with the toggle's own state. */
			shown: () => {
				expect(toggle().checked).toBe(checkbox().checked);
				return checkbox().checked;
			},
			failed: () => el.querySelector('[data-test="auto-check-failed"]') !== null,
			/** A click on the toggle, as the browser does it: the checkbox changes, then its change event. */
			click: () => {
				checkbox().click();
				fixture.detectChanges();
			}
		};
	}

	beforeEach(() => jest.resetAllMocks());

	it('off by default; an administrator who may change integrations turns it on', () => {
		api.setLookupAutoCheck.mockReturnValue(of({ auto_check: true }));
		const { click, saved, shown } = render(true);
		expect(shown()).toBe(false);
		click();
		expect(api.setLookupAutoCheck).toHaveBeenCalledWith(ORGANIZATION.id, true);
		expect(shown()).toBe(true);
		expect(saved).toEqual([true]);
	});

	it.each([
		['turned on', false],
		['turned off', true]
	])(
		'%s, a save that fails at once puts the toggle and its checkbox back, and the next click is taken',
		(_label, before) => {
			api.setLookupAutoCheck.mockReturnValueOnce(throwError(() => ({ status: 502 })));
			const { click, failed, saved, shown } = render(true, before);
			expect(shown()).toBe(before);
			click();
			expect(api.setLookupAutoCheck).toHaveBeenCalledWith(ORGANIZATION.id, !before);
			expect(shown()).toBe(before);
			expect(failed()).toBe(true);
			expect(saved).toEqual([]);
			api.setLookupAutoCheck.mockReturnValueOnce(of({ auto_check: !before }));
			click();
			expect(api.setLookupAutoCheck).toHaveBeenCalledTimes(2);
			expect(shown()).toBe(!before);
			expect(failed()).toBe(false);
			expect(saved).toEqual([!before]);
		}
	);

	it('a save that fails later shows the value asked for while it is saved, then puts the toggle back', () => {
		const answer = new Subject<{ auto_check: boolean }>();
		api.setLookupAutoCheck.mockReturnValueOnce(answer);
		const { checkbox, click, failed, fixture, saved, shown } = render(true);
		click();
		expect(shown()).toBe(true);
		expect(checkbox().disabled).toBe(true);
		answer.error({ status: 502 });
		fixture.detectChanges();
		expect(shown()).toBe(false);
		expect(checkbox().disabled).toBe(false);
		expect(failed()).toBe(true);
		api.setLookupAutoCheck.mockReturnValueOnce(of({ auto_check: true }));
		click();
		expect(api.setLookupAutoCheck).toHaveBeenCalledTimes(2);
		expect(shown()).toBe(true);
		expect(saved).toEqual([true]);
	});

	it('the saved value follows the integrations list', () => {
		const { fixture, shown } = render(true);
		fixture.componentRef.setInput('autoCheck', true);
		fixture.detectChanges();
		expect(shown()).toBe(true);
	});

	it('without INTEGRATION_EDIT nothing is sent', () => {
		const { checkbox, click, toggle } = render(false);
		expect(checkbox().disabled).toBe(true);
		click();
		// Even a change that reaches the component (the toggle is disabled) is not saved.
		toggle().checkedChange.emit(true);
		expect(api.setLookupAutoCheck).not.toHaveBeenCalled();
	});
});
