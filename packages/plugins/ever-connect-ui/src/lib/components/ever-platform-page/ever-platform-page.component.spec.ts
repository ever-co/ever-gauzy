// cspell:ignore abcdefghijk
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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
		connect: jest.fn()
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
