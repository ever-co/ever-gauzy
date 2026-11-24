// cspell:ignore abcdefghijk
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { EverConnectStatus, EverConnectUiService } from '../../services/ever-connect.service';
import { EverPlatformPageComponent } from './ever-platform-page.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };

const STATUS: EverConnectStatus = {
	enabled: true,
	install_source: 'self-hosted',
	managed_by: 'operator',
	operator: true,
	connected: true,
	connection: {
		status: 'connected',
		platform_instance_id: '01JD4M2N3P4Q5R6S7T8V9V0W1X',
		kid: 'abcdefghijk',
		owner_handle: 'acme',
		connected_at: '2026-10-03T10:00:00.000Z',
		last_heartbeat_at: null,
		feed_mode: 'longpoll',
		last_error: null,
		api_url: 'https://api.ever.co',
		return_url: null,
		key_material: 'ok',
		env_code: 'none'
	},
	installation_links: {
		total: 1,
		items: [
			{
				link_id: '01JD4M2N3P4Q5R6S7T8V9V0W2Y',
				ever_org_id: '01JD4M2N3P4Q5R6S7T8V9V0W3Z',
				handle: 'acme',
				status: 'linked',
				linked_at: '2026-10-03T10:00:00.000Z'
			}
		]
	},
	link: null,
	pending_approvals: [],
	in_product_consent: false
};

/**
 * The Ever Platform page: where the module is not loaded it only says so (and asks nothing else);
 * the Connection tab is the operator's; nothing is enabled from the page.
 */
describe('EverPlatformPageComponent', () => {
	const api = {
		status: jest.fn(),
		integrations: jest.fn(),
		refresh: jest.fn(),
		entitlement: jest.fn(),
		audit: jest.fn(),
		policy: jest.fn(),
		consentUrl: jest.fn(),
		disable: jest.fn(),
		connect: jest.fn(),
		checkApproval: jest.fn(),
		setPublicUrl: jest.fn(),
		clearPublicUrl: jest.fn()
	};

	function render(canEdit = true) {
		TestBed.configureTestingModule({
			imports: [EverPlatformPageComponent],
			providers: [
				{ provide: EverConnectUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION), hasPermission: () => canEdit } }
			]
		});
		const fixture = TestBed.createComponent(EverPlatformPageComponent);
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
		api.integrations.mockReturnValue(of([]));
		api.refresh.mockReturnValue(of([]));
		api.entitlement.mockReturnValue(of({ instance: null, link: null }));
		api.audit.mockReturnValue(of({ items: [], total: 0 }));
		api.policy.mockReturnValue(of([]));
	});

	it('the module is not loaded (404): says so, asks nothing else', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(api.integrations).not.toHaveBeenCalled();
		expect(api.policy).not.toHaveBeenCalled();
	});

	it('the operator sees the Connection tab and the policy', () => {
		api.status.mockReturnValue(of(STATUS));
		const { component, find } = render();
		expect(component.view).toBe('ready');
		expect(find('tab-connection')).not.toBeNull();
		expect(api.policy).toHaveBeenCalled();
		expect(api.refresh).toHaveBeenCalledWith(ORGANIZATION.id);
	});

	it('another administrator: no Connection tab, no policy request', () => {
		api.status.mockReturnValue(of({ ...STATUS, operator: false, connection: null }));
		const { find } = render();
		expect(find('tab-connection')).toBeNull();
		expect(api.policy).not.toHaveBeenCalled();
	});

	it('Ever Cloud: the Connection tab says it is operated by Ever Cloud', () => {
		api.status.mockReturnValue(of({ ...STATUS, managed_by: 'ever_cloud', operator: false, connection: null }));
		const { find } = render();
		expect(find('tab-connection')).not.toBeNull();
		expect(find('ever-cloud')).not.toBeNull();
		expect(find('connect')).toBeNull();
	});

	it('Ever Cloud, an operator the deployment lists: the whole Connection tab, its links and the policy', () => {
		api.status.mockReturnValue(
			of({
				...STATUS,
				install_source: 'cloud',
				managed_by: 'ever_cloud',
				connection: { ...STATUS.connection!, connect_key: 'ok' }
			})
		);
		const { find } = render();
		expect(find('ever-cloud')?.textContent).toContain('EVER_CONNECT.CONNECTION.EVER_CLOUD_OPERATOR');
		expect(find('connection')).not.toBeNull();
		expect(find('connection-state')).not.toBeNull();
		expect(find('rotate-key')).not.toBeNull();
		expect(find('disconnect')).not.toBeNull();
		expect(find('installation-links')?.textContent).toContain('ever.co/acme');
		expect(find('installation-links-more')).toBeNull();
		expect(api.policy).toHaveBeenCalled();
	});

	it('Ever Cloud, waiting for approval: Check again says whether it is still waiting', () => {
		const pending = {
			...STATUS,
			managed_by: 'ever_cloud' as const,
			connected: false,
			connection: { ...STATUS.connection!, status: 'pending_approval' as const },
			installation_links: { total: 0, items: [] }
		};
		api.status.mockReturnValue(of(pending));
		api.checkApproval.mockReturnValue(of({ status: 'pending_approval' }));
		const { component, fixture, find } = render();
		expect(find('rotate-key')).toBeNull();
		expect(find('no-installation-links')).not.toBeNull();
		(find('check') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(api.checkApproval).toHaveBeenCalledTimes(1);
		expect(component.notice).toBe('EVER_CONNECT.NOTICES.STILL_PENDING');
		api.checkApproval.mockReturnValue(of({ status: 'connected' }));
		component.checkApproval();
		expect(component.notice).toBe('EVER_CONNECT.NOTICES.CONNECTED');
	});

	it('the operator of an installation with more links than are listed: says how many are shown', () => {
		const items = STATUS.installation_links!.items;
		api.status.mockReturnValue(of({ ...STATUS, installation_links: { total: 60, items } }));
		const { find } = render();
		expect(find('installation-links-more')?.textContent).toContain('EVER_CONNECT.CONNECTION.LINKS_MORE');
	});

	const withAddress = (instance_url: { enabled: boolean; url: string | null }) => ({
		...STATUS,
		connection: { ...STATUS.connection!, instance_url }
	});

	it('the installation address: nothing to type until "Installation address" is enabled', () => {
		api.status.mockReturnValue(of(withAddress({ enabled: false, url: null })));
		const { find } = render();
		expect(find('address-off')).not.toBeNull();
		expect(find('address-input')).toBeNull();
	});

	it('the installation address: reported as the operator types it, and withdrawn', () => {
		api.status.mockReturnValue(of(withAddress({ enabled: true, url: 'https://gauzy.acme.example/' })));
		api.setPublicUrl.mockReturnValue(of({ enabled: true, url: 'https://gauzy.acme.example/app' }));
		api.clearPublicUrl.mockReturnValue(of({ enabled: true, url: null }));
		const { component, find } = render();
		expect(find('address-off')).toBeNull();
		expect(find('address-reported')?.textContent).toContain('EVER_CONNECT.ADDRESS.REPORTED');
		component.publicUrl = '  https://gauzy.acme.example/app  ';
		component.reportAddress();
		expect(api.setPublicUrl).toHaveBeenCalledWith('https://gauzy.acme.example/app');
		expect(component.publicUrl).toBe('');
		expect(find('address-input')?.getAttribute('aria-label')).toBe('EVER_CONNECT.ADDRESS.TITLE');
		expect(component.notice).toBe('EVER_CONNECT.NOTICES.ADDRESS_REPORTED');
		component.withdrawAddress();
		expect(api.clearPublicUrl).toHaveBeenCalledTimes(1);
		expect(component.notice).toBe('EVER_CONNECT.NOTICES.ADDRESS_WITHDRAWN');
	});

	it('the installation address: an address typed while the report is on its way stays', () => {
		api.status.mockReturnValue(of(withAddress({ enabled: true, url: null })));
		const answer = new Subject<{ enabled: boolean; url: string | null }>();
		api.setPublicUrl.mockReturnValue(answer);
		const { component } = render();
		component.publicUrl = 'https://a.acme.example';
		component.reportAddress();
		component.publicUrl = 'https://b.acme.example';
		answer.next({ enabled: true, url: 'https://a.acme.example/' });
		answer.complete();
		expect(component.publicUrl).toBe('https://b.acme.example');
	});

	it('the installation address: a refused address says why', () => {
		api.status.mockReturnValue(of(withAddress({ enabled: true, url: null })));
		api.setPublicUrl.mockReturnValue(throwError(() => ({ status: 400, error: { code: 'url_invalid' } })));
		const { component, find } = render();
		expect(find('address-withdraw')).toBeNull();
		component.publicUrl = 'https://10.0.0.1';
		component.reportAddress();
		expect(component.notice).toBe('EVER_CONNECT.ERRORS.url_invalid');
		expect(component.noticeStatus).toBe('danger');
		// The typed address stays, to be corrected and sent again.
		expect(component.publicUrl).toBe('https://10.0.0.1');
		api.setPublicUrl.mockReturnValue(throwError(() => ({ status: 409, error: { code: 'consent_required' } })));
		component.publicUrl = 'https://gauzy.acme.example';
		component.reportAddress();
		expect(component.notice).toBe('EVER_CONNECT.ERRORS.consent_required');
		expect(component.busy).toBe(false);
	});

	it('an administrator who may change integrations reads the states from Ever Platform', () => {
		api.status.mockReturnValue(of(STATUS));
		render(true);
		expect(api.refresh).toHaveBeenCalledWith(ORGANIZATION.id);
		expect(api.integrations).not.toHaveBeenCalled();
	});

	it('a viewer reads the states kept here (no call to Ever Platform)', () => {
		api.status.mockReturnValue(of(STATUS));
		render(false);
		expect(api.integrations).toHaveBeenCalledWith(ORGANIZATION.id);
		expect(api.refresh).not.toHaveBeenCalled();
	});

	it('the consent link is offered only where consent can be asked for here', () => {
		api.status.mockReturnValue(of({ ...STATUS, operator: false, connection: null }));
		const { component } = render();
		const base = { instance_wide: false, state: 'available' } as never;
		expect(component.canAskConsent(base)).toBe(true);
		expect(component.canAskConsent({ instance_wide: true, state: 'available' } as never)).toBe(false);
		expect(component.canAskConsent({ instance_wide: false, state: 'coming_soon' } as never)).toBe(false);
		expect(component.canAskConsent({ instance_wide: false, state: 'denied_by_policy' } as never)).toBe(false);
		expect(component.canAskConsent({ instance_wide: false, state: 'enabled' } as never)).toBe(false);
	});
	it('the Entitlements tab shows each licence as active, the grace notice, and the import for the operator only', () => {
		const document = {
			subject: 'link',
			status: 'stale',
			ladder: 'grace',
			licence_ids: ['EVER-GAUZY-SB-1A2B3C4D'],
			seq: 4,
			issued_at: '2026-10-01T00:00:00.000Z',
			expires_at: '2026-10-08T00:00:00.000Z',
			fetched_at: '2026-10-02T00:00:00.000Z',
			handle: 'acme',
			tier: 'paid',
			plan: 'gauzy-team',
			features: { discoverability: true },
			limits: {},
			meters: {}
		};
		api.entitlement.mockReturnValue(of({ instance: null, link: document }));
		api.status.mockReturnValue(of(STATUS));
		const { el, find } = render();
		const licences = Array.from(el.querySelectorAll('[data-test="licence"]'));
		expect(licences.map((node) => node.getAttribute('data-licence'))).toEqual(['EVER-GAUZY-SB-1A2B3C4D']);
		expect(licences[0].textContent).toContain('EVER_CONNECT.ENTITLEMENTS.LICENCE_ACTIVE');
		expect(el.textContent?.toLowerCase()).not.toContain('licence key');
		expect(find('entitlement-grace')).not.toBeNull();
		expect(find('entitlement-paused')).toBeNull();
		expect(find('import-entitlement')).not.toBeNull();
	});

	it('another administrator gets no import, and a paused document says so', () => {
		api.entitlement.mockReturnValue(
			of({
				instance: null,
				link: {
					subject: 'link',
					status: 'paused',
					ladder: 'paused',
					licence_ids: [],
					seq: 1,
					issued_at: null,
					expires_at: null,
					fetched_at: null,
					handle: null,
					tier: null,
					plan: null,
					features: {},
					limits: {},
					meters: {}
				}
			})
		);
		api.status.mockReturnValue(of({ ...STATUS, operator: false, connection: null }));
		const { find } = render();
		expect(find('entitlement-paused')).not.toBeNull();
		expect(find('import-entitlement')).toBeNull();
	});
});
