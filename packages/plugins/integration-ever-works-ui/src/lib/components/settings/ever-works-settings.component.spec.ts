import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NbToggleComponent } from '@nebular/theme';
import { of, Subject, throwError } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import type { EverWorksConflict, EverWorksConnection, EverWorksMapping, EverWorksSyncStatus } from '../../services/ever-works.service';
import { EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksSettingsComponent, SETTINGS_POLL_MS } from './ever-works-settings.component';

const ORGANIZATION = { id: '11111111-2222-4333-8444-555555555555' };
const ID = '99999999-2222-4333-8444-555555555555';

const STATUS = { enabled: true, pluginVersion: '0.1.0', contractVersion: '1', defaultApiUrl: null, appUrl: null };
const CONNECTION = {
	id: 'c1',
	status: 'active',
	key: { id: 'k1', name: 'Ever Gauzy', prefix: 'ew_int_ab' },
	webhook: { registered: true, subscriptionId: 's1', url: 'u' }
} as unknown as EverWorksConnection;
const MAPPING = {
	integrationTenantId: ID,
	isEnabled: true,
	everWorksOrganization: { id: 'ew-org', slug: 'acme', displayName: 'Acme' },
	directions: {},
	syncUnlinkedProjectTasks: true
} as unknown as EverWorksMapping;
const RUN = {
	id: 'run-1',
	mode: 'initial',
	reason: 'admin',
	status: 'running',
	feedHead: '10',
	currentPhase: 'teams',
	phases: [
		{ name: 'agents', status: 'done', queued: 2, duplicates: 0, exported: 0, attempts: 0 },
		{ name: 'teams', status: 'applying', queued: 3, duplicates: 0, exported: 1, attempts: 0 }
	],
	requestedByUserId: null,
	startedAt: null,
	finishedAt: null,
	lastProgressAt: null,
	lastError: null
};
const SYNC = {
	integrationTenantId: ID,
	organizationId: ORGANIZATION.id,
	isEnabled: true,
	directions: {},
	connection: { id: 'c1', status: 'active', lastError: null, lastErrorAt: null, lastHealthyAt: null, lastFeedPollAt: null, lastWebhookAt: null, resyncRequested: false },
	lag: { head: '12', readUpTo: '11', lastApplied: '10', behind: '2', headError: null },
	inbound: { pending: 1, deferred: 0, failed: 0, dead: 3 },
	outbound: { pending: 0, pushing: 0, deferred: 0, failed: 0, dead: 0 },
	conflicts: { open: 1 },
	lastError: null,
	entities: [{ entityType: 'TEAM', total: 2, ok: 2, conflict: 0, error: 0, orphaned: 0, unlinked: 0 }],
	run: null,
	runs: [{ ...RUN, status: 'done' }]
} as unknown as EverWorksSyncStatus;
const CONFLICT = {
	id: 'conf-1',
	createdAt: '2026-10-16T22:00:00.000Z',
	direction: 'inbound',
	entityType: 'TEAM',
	gauzyId: 'g1',
	ewId: 'e1',
	message: null,
	details: { field: 'name', gauzyValue: 'Platform', everWorksValue: 'Platform team', winner: 'ever_works' },
	resolved: false,
	resolvedAt: null,
	resolvedByUserId: null,
	canUseOther: true
} as EverWorksConflict;

/** The sync settings of a mapping: overview, activity (log, conflicts) and advanced actions. */
describe('EverWorksSettingsComponent', () => {
	const api = {
		status: jest.fn(),
		connection: jest.fn(),
		currentMapping: jest.fn(),
		syncStatus: jest.fn(),
		syncLog: jest.fn(),
		conflicts: jest.fn(),
		resolveConflict: jest.fn(),
		resync: jest.fn(),
		cancelSync: jest.fn(),
		startSync: jest.fn(),
		registerWebhook: jest.fn(),
		pause: jest.fn(),
		resume: jest.fn(),
		rotateKey: jest.fn(),
		disconnect: jest.fn(),
		updateMapping: jest.fn(),
		preview: jest.fn(),
		people: jest.fn(),
		agents: jest.fn(),
		teams: jest.fn(),
		projects: jest.fn(),
		initiatives: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({
			imports: [EverWorksSettingsComponent],
			providers: [
				{ provide: EverWorksUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION) } },
				// `params` too: the settings tabs (`nb-tabset`) read `route.params` when their content is ready.
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ integrationTenantId: ID })), params: of({ integrationTenantId: ID }) } }
			]
		});
		const fixture = TestBed.createComponent(EverWorksSettingsComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const find = (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null;
		return { fixture, component: fixture.componentInstance, find };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.status.mockReturnValue(of(STATUS));
		api.connection.mockReturnValue(of(CONNECTION));
		api.currentMapping.mockReturnValue(of(MAPPING));
		api.syncStatus.mockReturnValue(of(SYNC));
		api.syncLog.mockReturnValue(of({ items: [], nextCursor: null }));
		api.conflicts.mockReturnValue(of({ items: [CONFLICT], nextCursor: null }));
		api.preview.mockReturnValue(of({ integrationTenantId: ID, generatedAt: '', isEnabled: true, directions: {}, phases: [] }));
		api.people.mockReturnValue(of({ members: [], unmatchedEmployees: [] }));
		api.agents.mockReturnValue(of([]));
		api.teams.mockReturnValue(of({ teams: [], unmatchedTeams: [] }));
		api.projects.mockReturnValue(of({ works: [], unmatchedProjects: [] }));
		api.initiatives.mockReturnValue(of({ missions: [], unmatchedInitiatives: [] }));
	});

	afterEach(() => jest.useRealTimers());

	it('the plugin is not loaded (404): says so and reads nothing else', () => {
		api.status.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(api.syncStatus).not.toHaveBeenCalled();
	});

	it("another organization's mapping (or none) is not shown", () => {
		api.currentMapping.mockReturnValue(of({ ...MAPPING, integrationTenantId: 'another' }));
		const { component, find } = render();
		expect(component.view).toBe('not-found');
		expect(find('not-found')).not.toBeNull();
		expect(api.syncStatus).not.toHaveBeenCalled();
	});

	it('overview: lag, queues, conflicts, link totals and the latest run; resync starts one', () => {
		api.resync.mockReturnValue(of({ ...RUN }));
		const { component, find, fixture } = render();
		expect(component.view).toBe('ready');
		expect(api.syncStatus).toHaveBeenCalledWith(ORGANIZATION.id, ID);
		expect(find('open-conflicts')?.textContent?.trim()).toBe('1');
		expect(find('entities')).not.toBeNull();
		expect(find('phases')?.querySelectorAll('li').length).toBe(2);
		expect(find('first-sync')).toBeNull();
		find('resync')?.click();
		fixture.detectChanges();
		expect(api.resync).toHaveBeenCalledWith(ORGANIZATION.id, ID);
		expect(api.syncStatus).toHaveBeenCalledTimes(2); // read again after the action
	});

	it('a mapping that never synced offers the dry run and Start', () => {
		api.syncStatus.mockReturnValue(of({ ...SYNC, runs: [], run: null }));
		api.startSync.mockReturnValue(of({ ...RUN }));
		const { find, fixture } = render();
		expect(find('first-sync')).not.toBeNull();
		expect(api.preview).toHaveBeenCalledWith(ORGANIZATION.id, ID);
		find('start-first')?.click();
		fixture.detectChanges();
		expect(api.registerWebhook).not.toHaveBeenCalled(); // already registered
		expect(api.startSync).toHaveBeenCalledWith(ORGANIZATION.id, ID);
	});

	it('a running sync can be cancelled, and its status is read again while it runs', () => {
		jest.useFakeTimers();
		api.syncStatus.mockReturnValue(of({ ...SYNC, run: RUN, runs: [RUN] }));
		api.cancelSync.mockReturnValue(of({ ...RUN, status: 'cancelled' }));
		const { find, fixture } = render();
		expect(find('resync')).toBeNull();
		expect(api.syncStatus).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(SETTINGS_POLL_MS);
		expect(api.syncStatus).toHaveBeenCalledTimes(2);
		find('cancel-run')?.click();
		fixture.detectChanges();
		expect(api.cancelSync).toHaveBeenCalledWith(ORGANIZATION.id, ID);
	});

	it('conflicts: keep, or use the other value, then the list is read again', () => {
		api.resolveConflict.mockReturnValue(of({ ...CONFLICT, resolved: true }));
		const { component } = render();
		expect(component.conflicts).toHaveLength(1);
		component.resolve(CONFLICT, 'use_other');
		expect(api.resolveConflict).toHaveBeenCalledWith(ORGANIZATION.id, ID, 'conf-1', 'use_other');
		expect(api.conflicts).toHaveBeenCalledTimes(2);
		expect(component.notice).toBe('EVER_WORKS.SETTINGS.USED_OTHER');
	});

	it('the sync log follows its filters and pages with the cursor', () => {
		api.syncLog.mockReturnValue(of({ items: [{ id: 'l1' }], nextCursor: '50' }));
		const { component } = render();
		expect(component.logCursor).toBe('50');
		component.loadLog(false);
		expect(api.syncLog).toHaveBeenLastCalledWith(ORGANIZATION.id, ID, { status: null, direction: null, cursor: '50' });
		expect(component.log).toHaveLength(2);
		component.logStatus = 'error';
		component.loadLog(true);
		expect(api.syncLog).toHaveBeenLastCalledWith(ORGANIZATION.id, ID, { status: 'error', direction: null, cursor: null });
	});

	it('a new key replaces the old one and leaves the form; a refusal is shown', () => {
		api.rotateKey.mockReturnValueOnce(throwError(() => ({ status: 400, error: { message: 'The new key belongs to another Ever Works tenant.' } })));
		const { component, fixture, find } = render();
		component.newKey = ' ew_int_new ';
		component.rotateKey();
		fixture.detectChanges();
		expect(api.rotateKey).toHaveBeenCalledWith(ORGANIZATION.id, 'c1', 'ew_int_new');
		expect(find('action-error')?.textContent).toContain('another Ever Works tenant');
		api.rotateKey.mockReturnValue(of(CONNECTION));
		component.rotateKey();
		expect(component.newKey).toBe('');
	});

	it('disconnect asks twice, then leaves for the connect page', () => {
		api.disconnect.mockReturnValue(of({ success: true, webhookDeleted: true }));
		const { component } = render();
		const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		// The Advanced tab shows "Disconnect" first; only its confirmation calls the API.
		expect(component.confirmDisconnect).toBe(false);
		expect(api.disconnect).not.toHaveBeenCalled();
		component.confirmDisconnect = true;
		component.disconnect();
		expect(api.disconnect).toHaveBeenCalledWith(ORGANIZATION.id, 'c1');
		expect(component.confirmDisconnect).toBe(false);
		expect(navigate).toHaveBeenCalledWith(['/pages/integrations/ever-works']);
	});

	it('a webhook the wizard could not register is shown when the settings open', () => {
		const state = jest.spyOn(globalThis.history, 'state', 'get').mockReturnValue({ everWorksWebhookWarning: 'API_BASE_URL is not set.' });
		const { component, find } = render();
		expect(component.notice).toBe('EVER_WORKS.PREVIEW.WEBHOOK_NOT_REGISTERED');
		expect(component.noticeParams).toEqual({ reason: 'API_BASE_URL is not set.' });
		expect(find('notice')).not.toBeNull();
		state.mockRestore();
	});

	it('the wizard\u2019s webhook warning is read once: a reload or a back/forward visit does not show it again (review F102)', () => {
		const state = jest.spyOn(globalThis.history, 'state', 'get').mockReturnValue({ navigationId: 3, everWorksWebhookWarning: 'API_BASE_URL is not set.' });
		const replace = jest.spyOn(globalThis.history, 'replaceState').mockImplementation(() => undefined);
		const { component } = render();
		expect(component.notice).toBe('EVER_WORKS.PREVIEW.WEBHOOK_NOT_REGISTERED');
		// The router's own state stays on the entry; only the warning goes.
		expect(replace).toHaveBeenCalledWith({ navigationId: 3 }, '');
		state.mockRestore();
		replace.mockRestore();
	});

	it('a switch of the mapping that fails shows the mapping\u2019s real state again (review F101)', () => {
		api.currentMapping.mockReturnValue(of({ ...MAPPING, isEnabled: false }));
		api.syncStatus.mockReturnValue(of({ ...SYNC, isEnabled: false }));
		const answer = new Subject<EverWorksMapping>();
		api.updateMapping.mockReturnValue(answer);
		const { component, fixture, find } = render();
		const toggle = fixture.debugElement.query(By.directive(NbToggleComponent)).componentInstance as NbToggleComponent;
		const host = find('mapping-enabled') as HTMLElement;
		const input = host.querySelector('input') as HTMLInputElement;
		expect(toggle.checked).toBe(false);
		input.click();
		fixture.detectChanges();
		expect(api.updateMapping).toHaveBeenCalledWith(ORGANIZATION.id, ID, { isEnabled: true });
		expect(input.checked).toBe(true);
		// The API refuses (403, or a transient 5xx) after the switch has moved.
		answer.error({ status: 403, error: { message: 'Forbidden resource' } });
		fixture.detectChanges();
		expect(find('action-error')?.textContent).toContain('Forbidden');
		expect(component.mapping?.isEnabled).toBe(false);
		expect(toggle.checked).toBe(false);
		expect(input.checked).toBe(false);
	});

	it('the sync status cannot be read (an older API): the settings still open, with the error on the overview', () => {
		api.syncStatus.mockReturnValue(throwError(() => ({ status: 404, error: { message: 'Cannot GET /api/integration/ever-works/mappings/x/sync/status' } })));
		const { component, find } = render();
		expect(component.view).toBe('ready');
		expect(find('sync-error')?.textContent).toContain('Cannot GET');
		expect(find('tab-advanced')).not.toBeNull();
	});

	it('a refreshed status also moves the controls (a pause made elsewhere shows on the buttons)', () => {
		const { component } = render();
		expect(component.canSync).toBe(true);
		api.syncStatus.mockReturnValue(of({ ...SYNC, connection: { ...SYNC.connection, status: 'paused' } }));
		component.refreshStatus();
		expect(component.connection?.status).toBe('paused');
		expect(component.canSync).toBe(false);
	});

	it('answers to requests of a mapping that is no longer shown are dropped', () => {
		const late = new Subject<EverWorksSyncStatus>();
		const { component } = render();
		api.syncStatus.mockReturnValue(late);
		component.refreshStatus();
		// The page reads its mapping again (another organization would do the same); that load reads the status
		// afresh, so it gets its own answer, not the late one.
		api.syncStatus.mockReturnValue(of(SYNC));
		component.reload();
		late.next({ ...SYNC, conflicts: { open: 42 } });
		expect(component.sync?.conflicts.open).not.toBe(42);
	});

	it('a failed status read during a running sync keeps polling', () => {
		jest.useFakeTimers();
		api.syncStatus.mockReturnValue(of({ ...SYNC, run: RUN, runs: [RUN] }));
		const { component } = render();
		api.syncStatus.mockReturnValueOnce(throwError(() => ({ status: 503 })));
		jest.advanceTimersByTime(SETTINGS_POLL_MS); // this read fails…
		expect(component.syncError).not.toBeNull();
		jest.advanceTimersByTime(SETTINGS_POLL_MS); // …and the next one still happens
		expect(api.syncStatus).toHaveBeenCalledTimes(3);
	});

	it('the latest log or conflicts request wins; an action dropped by a page change unlocks the controls', () => {
		const slow = new Subject<{ items: never[]; nextCursor: null }>();
		const { component } = render();
		api.syncLog.mockReturnValueOnce(slow).mockReturnValueOnce(of({ items: [{ id: 'new' }], nextCursor: null }));
		component.logStatus = 'ok';
		component.loadLog(true);
		component.logStatus = 'error';
		component.loadLog(true);
		slow.next({ items: [], nextCursor: null });
		expect(component.log.map((entry) => entry.id)).toEqual(['new']);
		const pending = new Subject<unknown>();
		api.resync.mockReturnValue(pending);
		component.resync();
		expect(component.busy).toBe(true);
		component.reload();
		expect(component.busy).toBe(false);
	});

	it('an unchanged status read keeps the mapping object (an unsaved directions draft survives polling)', () => {
		const { component } = render();
		const mapping = component.mapping;
		component.refreshStatus();
		expect(component.mapping).toBe(mapping);
	});
});
