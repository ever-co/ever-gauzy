import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EverWorksConnection, EverWorksKeyValidation, EverWorksMapping, EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksConnectComponent } from './ever-works-connect.component';

const ORGANIZATION_ID = '11111111-2222-4333-8444-555555555555';

const VALIDATION: EverWorksKeyValidation = {
	apiBaseUrl: 'https://api.example.test/api',
	keyId: 'k1',
	keyName: 'Ever Gauzy — Acme',
	keyPrefix: 'ew_int_ab',
	tenant: { id: 'ew-tenant', slug: 'acme-tenant' },
	organizations: [{ id: 'ew-org-1', slug: 'acme', displayName: 'Acme' }],
	scopes: ['events:read', 'webhooks:manage'],
	missingScopes: [],
	missingRequiredScopes: [],
	apiVersion: '1',
	compatible: true,
	feedHead: '10',
	limits: { readsPerMin: 3000, writesPerMin: 600 }
};

const CONNECTION = {
	id: 'c1',
	status: 'active',
	ewTenant: { id: 'ew-tenant', slug: 'acme-tenant' },
	key: { id: 'k1', name: 'Ever Gauzy — Acme', prefix: 'ew_int_ab' },
	pinnedOrganizations: [{ id: 'ew-org-1', slug: 'acme', displayName: 'Acme' }],
	webhook: { registered: false, subscriptionId: null, url: null }
} as unknown as EverWorksConnection;

const MAPPING = { integrationTenantId: 'm1', directions: { tasks: 'both' }, syncUnlinkedProjectTasks: true } as unknown as EverWorksMapping;

/** The connect wizard: key → validate → connect → map → review → directions → preview → start. */
describe('EverWorksConnectComponent', () => {
	const api = {
		validate: jest.fn(),
		connect: jest.fn(),
		createMapping: jest.fn(),
		registerWebhook: jest.fn(),
		rotateKey: jest.fn(),
		resume: jest.fn(),
		disconnect: jest.fn(),
		startSync: jest.fn(),
		updateMapping: jest.fn(),
		preview: jest.fn(),
		people: jest.fn(),
		agents: jest.fn(),
		teams: jest.fn(),
		projects: jest.fn(),
		initiatives: jest.fn(),
		decideInitiatives: jest.fn(),
		decidePeople: jest.fn(),
		decideTeams: jest.fn(),
		decideProjects: jest.fn()
	};

	function render(inputs: Partial<EverWorksConnectComponent> = {}) {
		TestBed.configureTestingModule({ imports: [EverWorksConnectComponent], providers: [{ provide: EverWorksUiService, useValue: api }] });
		const fixture = TestBed.createComponent(EverWorksConnectComponent);
		Object.assign(fixture.componentInstance, { organizationId: ORGANIZATION_ID, defaultApiUrl: 'https://api.example.test/api', ...inputs });
		fixture.componentInstance.ngOnChanges();
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const find = (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null;
		return { fixture, component: fixture.componentInstance, find, click: (test: string) => (find(test)?.click(), fixture.detectChanges()) };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.preview.mockReturnValue(of({ integrationTenantId: 'm1', generatedAt: '', isEnabled: true, directions: {}, phases: [] }));
		api.people.mockReturnValue(of({ members: [], unmatchedEmployees: [] }));
		api.agents.mockReturnValue(of([]));
		api.teams.mockReturnValue(of({ teams: [], unmatchedTeams: [] }));
		api.projects.mockReturnValue(of({ works: [], unmatchedProjects: [] }));
		api.initiatives.mockReturnValue(of({ missions: [], unmatchedInitiatives: [] }));
	});

	it('starts with the key steps and the preset link; the default API URL is prefilled', () => {
		const { component, find, click } = render({ newKeyUrl: 'https://app.example.test/settings/api-keys?new=integration&preset=ever-gauzy' });
		expect(component.step).toBe('key');
		expect(find('create-key')?.getAttribute('href')).toContain('preset=ever-gauzy');
		click('have-key');
		expect(component.step).toBe('connect');
		expect(component.apiBaseUrl).toBe('https://api.example.test/api');
	});

	it('validates the key, shows what it is, and connects only a compatible key with the required scopes', () => {
		api.validate.mockReturnValue(of({ ...VALIDATION, missingRequiredScopes: ['webhooks:manage'] }));
		const { component, find, click, fixture } = render();
		component.go('connect');
		component.apiKey = 'ew_int_secret';
		fixture.detectChanges();
		click('validate');
		expect(api.validate).toHaveBeenCalledWith(ORGANIZATION_ID, 'https://api.example.test/api', 'ew_int_secret');
		expect(find('validation-tenant')?.textContent).toContain('acme-tenant');
		expect(find('missing-required')).not.toBeNull();
		expect(component.canConnect).toBe(false);
		api.validate.mockReturnValue(of(VALIDATION));
		click('validate');
		expect(component.canConnect).toBe(true);
		api.connect.mockReturnValue(of(CONNECTION));
		click('connect');
		expect(api.connect).toHaveBeenCalledWith(ORGANIZATION_ID, 'https://api.example.test/api', 'ew_int_secret');
		// The key leaves the form once it is stored.
		expect(component.apiKey).toBe('');
		expect(component.step).toBe('organization');
		expect(component.everWorksOrganizationId).toBe('ew-org-1');
	});

	it('an incompatible API version is refused before anything is stored', () => {
		api.validate.mockReturnValue(of({ ...VALIDATION, compatible: false, apiVersion: '2' }));
		const { component, find, click, fixture } = render();
		component.go('connect');
		component.apiKey = 'ew_int_secret';
		fixture.detectChanges();
		click('validate');
		expect(find('incompatible')).not.toBeNull();
		expect(component.canConnect).toBe(false);
		component.connect();
		expect(api.connect).not.toHaveBeenCalled();
	});

	it('shows the API message of a refused key', () => {
		api.validate.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Ever Works refused the key (invalid_key).' } })));
		const { component, find, click, fixture } = render();
		component.go('connect');
		component.apiKey = 'ew_int_bad';
		fixture.detectChanges();
		click('validate');
		expect(find('connect-error')?.textContent).toContain('invalid_key');
		expect(component.validation).toBeNull();
	});

	it('an existing connection starts at the organization step; mapping moves on to the review', () => {
		api.createMapping.mockReturnValue(of(MAPPING));
		const { component, find, click } = render({ connection: CONNECTION });
		expect(component.step).toBe('organization');
		expect(find('existing-connection')).not.toBeNull();
		click('map');
		expect(api.createMapping).toHaveBeenCalledWith(ORGANIZATION_ID, 'ew-org-1');
		expect(component.step).toBe('review');
		expect(api.people).toHaveBeenCalledWith(ORGANIZATION_ID, 'm1');
	});

	it('a connection that is not active cannot map an organization', () => {
		const { find } = render({ connection: { ...CONNECTION, status: 'needs_reauth' } as EverWorksConnection });
		expect(find('connection-not-active')).not.toBeNull();
		expect((find('map') as HTMLButtonElement).disabled).toBe(true);
	});

	it('a connection that is not active, with no mapping yet, is recovered on the organization step (review F99)', () => {
		const needsReauth = { ...CONNECTION, status: 'needs_reauth' } as EverWorksConnection;
		api.rotateKey.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'The new key belongs to another Ever Works tenant.' } })));
		const { component, find, click, fixture } = render({ connection: needsReauth });
		// A new key of the same tenant: the connection is active again and the organization can be mapped.
		expect(find('recover')).not.toBeNull();
		expect((find('recover-rotate') as HTMLButtonElement).disabled).toBe(true);
		const keyInput = find('recover-key') as HTMLInputElement;
		keyInput.value = ' ew_int_new ';
		keyInput.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		click('recover-rotate');
		expect(api.rotateKey).toHaveBeenCalledWith(ORGANIZATION_ID, 'c1', 'ew_int_new');
		expect(find('connect-error')?.textContent).toContain('another Ever Works tenant');
		expect(component.newKey).toBe(' ew_int_new ');
		api.rotateKey.mockReturnValue(of(CONNECTION));
		click('recover-rotate');
		expect(component.newKey).toBe('');
		expect(component.connection?.status).toBe('active');
		expect(find('recover')).toBeNull();
		expect((find('map') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a paused connection with no mapping can be resumed (review F99)', () => {
		api.resume.mockReturnValue(of(CONNECTION));
		const { component, find, click } = render({ connection: { ...CONNECTION, status: 'paused' } as EverWorksConnection });
		click('recover-resume');
		expect(api.resume).toHaveBeenCalledWith(ORGANIZATION_ID, 'c1');
		expect(component.connection?.status).toBe('active');
		expect(find('recover')).toBeNull();
	});

	it('a failed connection with no mapping can be disconnected after a confirmation, and the wizard starts over (review F99)', () => {
		api.disconnect.mockReturnValue(of({ success: true, webhookDeleted: true }));
		const { component, find, click } = render({ connection: { ...CONNECTION, status: 'error' } as EverWorksConnection });
		click('recover-disconnect');
		expect(api.disconnect).not.toHaveBeenCalled();
		click('recover-confirm-disconnect');
		expect(api.disconnect).toHaveBeenCalledWith(ORGANIZATION_ID, 'c1');
		expect(component.connection).toBeNull();
		expect(component.step).toBe('key');
		expect(find('step-key')).not.toBeNull();
	});

	it('start registers the webhook (best effort), then starts the first sync and hands the run back', () => {
		api.registerWebhook.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'API_BASE_URL is not set.' } })));
		api.startSync.mockReturnValue(of({ id: 'run-1', status: 'running' }));
		const { component, click, fixture } = render({ connection: CONNECTION, mapping: MAPPING });
		const started = jest.fn();
		component.started.subscribe(started);
		component.go('start');
		fixture.detectChanges();
		click('start');
		expect(api.registerWebhook).toHaveBeenCalledWith(ORGANIZATION_ID, 'c1');
		expect(api.startSync).toHaveBeenCalledWith(ORGANIZATION_ID, 'm1');
		expect(started).toHaveBeenCalledWith({ mapping: MAPPING, run: { id: 'run-1', status: 'running' }, webhookError: 'API_BASE_URL is not set.' });
	});

	it('an already registered webhook is not registered again', () => {
		api.startSync.mockReturnValue(of({ id: 'run-1', status: 'running' }));
		const { component, click, fixture } = render({ connection: { ...CONNECTION, webhook: { registered: true, subscriptionId: 's', url: 'u' } } as EverWorksConnection, mapping: MAPPING });
		component.go('start');
		fixture.detectChanges();
		click('start');
		expect(api.registerWebhook).not.toHaveBeenCalled();
		expect(api.startSync).toHaveBeenCalledTimes(1);
	});

	it('only a new connection or mapping moves the wizard; another input keeps the step', () => {
		const { component } = render({ connection: CONNECTION, mapping: MAPPING });
		component.go('start');
		component.organizationName = 'Renamed';
		component.ngOnChanges({ organizationName: {} as never });
		expect(component.step).toBe('start');
		component.ngOnChanges({ mapping: {} as never });
		expect(component.step).toBe('review');
	});

	it('once the first sync has started, Start asks for nothing more', () => {
		api.registerWebhook.mockReturnValue(of(CONNECTION));
		api.startSync.mockReturnValue(of({ id: 'run-1', status: 'running' }));
		const { component } = render({ connection: CONNECTION, mapping: MAPPING });
		component.go('start');
		component.start();
		component.start();
		expect(api.startSync).toHaveBeenCalledTimes(1);
		expect(component.busy).toBe(true);
	});
});
