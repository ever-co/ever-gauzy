// The stores are the spec's own: the real `@gauzy/ui-core/core` loads the whole app shell.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, OrganizationProjectsService: class OrganizationProjectsService {} }));

import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { JiraConnectionSummary, JiraMapping, JiraRun, JiraSite, JiraUiService } from '../../services/jira-ui.service';
import { finishedRuns, JiraSettingsComponent } from './jira-settings.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

/** The first load waits on the projects (a promise); the page's runs poll keeps the zone from ever being stable. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
	fixture.detectChanges();
	await new Promise((resolve) => setTimeout(resolve, 0));
	fixture.detectChanges();
}

function connection(overrides: Partial<JiraConnectionSummary> = {}): JiraConnectionSummary {
	return {
		id: 'int-1',
		organizationId: 'org-1',
		cloudId: 'cloud-a',
		siteUrl: 'https://acme.atlassian.net',
		siteName: 'Acme',
		accountId: 'acc-1',
		accountName: 'Ada',
		siteRequired: false,
		webhookExpiresAt: null,
		webhookError: null,
		connectedByUserId: null,
		attentionReason: null,
		tokenExpiresAt: null,
		lastSyncedAt: null,
		createdAt: null,
		...overrides
	};
}

function site(overrides: Partial<JiraSite> = {}): JiraSite {
	return { id: 'cloud-a', url: 'https://acme.atlassian.net', name: 'Acme', selected: true, ...overrides };
}

function mapping(overrides: Partial<JiraMapping> = {}): JiraMapping {
	return {
		id: 'map-1',
		integrationId: 'int-1',
		jiraProjectId: '10000',
		jiraProjectKey: 'ACME',
		jiraProjectName: 'Acme',
		projectId: 'project-1',
		direction: 'inbound',
		statusMap: { new: 'open', indeterminate: 'in-progress', done: 'completed' },
		issueTypeIds: [],
		syncEnabled: true,
		lastImportedAt: null,
		lastCursor: null,
		lastError: null,
		...overrides
	};
}

function run(overrides: Partial<JiraRun> = {}): JiraRun {
	return {
		id: 'run-1',
		mappingId: 'map-1',
		kind: 'import',
		status: 'done',
		full: false,
		startedAt: '2026-11-11T08:00:00.000Z',
		finishedAt: '2026-11-11T08:01:00.000Z',
		createdCount: 1,
		updatedCount: 2,
		skippedCount: 0,
		failedCount: 0,
		lastError: null,
		conflictCount: 0,
		...overrides
	};
}

/** The sync log carries each run's conflict count; a count opens the conflicts that run found. */
describe('JiraSettingsComponent (sync log and conflicts)', () => {
	const api = {
		summary: jest.fn(),
		sites: jest.fn(),
		selectSite: jest.fn(),
		projects: jest.fn(),
		project: jest.fn(),
		mappings: jest.fn(),
		createMapping: jest.fn(),
		registerWebhook: jest.fn(),
		runs: jest.fn(),
		conflicts: jest.fn(),
		resolveConflict: jest.fn(),
		taskTitles: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({
			imports: [JiraSettingsComponent],
			providers: [
				{ provide: JiraUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION), selectedOrganization: ORGANIZATION } },
				{ provide: OrganizationProjectsService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) } },
				{ provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ integrationId: 'int-1' })) } }
			]
		});
		const fixture = TestBed.createComponent(JiraSettingsComponent);
		return fixture;
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.summary.mockReturnValue(of(connection()));
		api.sites.mockReturnValue(of([site()]));
		api.projects.mockReturnValue(of([]));
		api.mappings.mockReturnValue(of([]));
		api.runs.mockReturnValue(of([run(), run({ id: 'run-2', conflictCount: 3 })]));
		api.conflicts.mockReturnValue(of([]));
		api.taskTitles.mockReturnValue(of({}));
	});

	it("shows each run's conflict count, and a count lists that run's conflicts", async () => {
		const fixture = render();
		await settle(fixture);
		const el: HTMLElement = fixture.nativeElement;

		expect(el.querySelector('[data-test="run-conflicts-run-1"]')?.textContent?.trim()).toBe('0');
		expect(el.querySelector('[data-test="run-conflicts-run-1"] button')).toBeNull();
		const count = el.querySelector('[data-test="run-conflicts-run-2"] button') as HTMLButtonElement;
		expect(count.textContent?.trim()).toBe('3');
		// The conflict list is there, every run.
		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: null, take: 50 });

		count.click();
		fixture.detectChanges();

		expect(fixture.componentInstance.conflictRunId).toBe('run-2');
		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'open', runId: 'run-2', take: 50 });
		expect(el.querySelector('[data-test="run-filter"]')).not.toBeNull();
	});

	it('a run that finishes reads the conflicts again', async () => {
		api.runs.mockReturnValueOnce(of([run({ status: 'running' })])).mockReturnValueOnce(of([run({ status: 'done', conflictCount: 1 })]));
		const fixture = render();
		await settle(fixture);
		expect(api.conflicts).toHaveBeenCalledTimes(1);

		fixture.componentInstance.loadRuns();
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenCalledTimes(2);
	});

	it('a run that finishes while another still runs reads the conflicts again', async () => {
		api.runs
			.mockReturnValueOnce(of([run({ id: 'run-1', status: 'running' }), run({ id: 'run-2', status: 'running' })]))
			.mockReturnValueOnce(of([run({ id: 'run-1', status: 'done', conflictCount: 2 }), run({ id: 'run-2', status: 'running' })]));
		const fixture = render();
		await settle(fixture);
		expect(api.conflicts).toHaveBeenCalledTimes(1);

		fixture.componentInstance.loadRuns();
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenCalledTimes(2);
	});

	it('tells a finished run from one still running, a new one, or one gone from the list', () => {
		expect(finishedRuns([run({ status: 'running' })], [run({ status: 'running' })])).toBe(false);
		expect(finishedRuns([run({ status: 'running' })], [run({ status: 'failed' })])).toBe(true);
		expect(finishedRuns([run({ status: 'running' })], [])).toBe(true);
		expect(finishedRuns([run({ status: 'done' })], [run({ status: 'done' }), run({ id: 'run-9', status: 'running' })])).toBe(false);
		// Started and ended between two reads: finished, conflicts or not (its mapping's position moved).
		expect(finishedRuns([run({ status: 'done' })], [run({ status: 'done' }), run({ id: 'run-9', status: 'done', conflictCount: 2 })])).toBe(true);
		expect(finishedRuns([run({ status: 'done' })], [run({ status: 'done' }), run({ id: 'run-9', status: 'done', conflictCount: 0 })])).toBe(true);
	});

	it('a runs read answered after the page moved to another connection is dropped', async () => {
		const fixture = render();
		await settle(fixture);
		const late = new Subject<JiraRun[]>();
		api.runs.mockReturnValueOnce(late);
		fixture.componentInstance.loadRuns();
		fixture.componentInstance.integrationId = 'int-2';

		late.next([run({ id: 'run-of-int-1' })]);

		expect(fixture.componentInstance.runs.map((item) => item.id)).toEqual(['run-1', 'run-2']);
	});
});

/** The site, the webhook, the add form (status map and issue types) and the run reports. */
describe('JiraSettingsComponent (site, webhook, mappings, reports)', () => {
	const api = {
		summary: jest.fn(),
		sites: jest.fn(),
		selectSite: jest.fn(),
		projects: jest.fn(),
		project: jest.fn(),
		mappings: jest.fn(),
		createMapping: jest.fn(),
		registerWebhook: jest.fn(),
		runs: jest.fn(),
		conflicts: jest.fn(),
		resolveConflict: jest.fn(),
		taskTitles: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({
			imports: [JiraSettingsComponent],
			providers: [
				{ provide: JiraUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION), selectedOrganization: ORGANIZATION } },
				{ provide: OrganizationProjectsService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [{ id: 'project-1', name: 'Website' }] }) } },
				{ provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ integrationId: 'int-1' })) } }
			]
		});
		const fixture = TestBed.createComponent(JiraSettingsComponent);
		// A notice is its key: the spec loads no translations.
		jest.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation((key: string | string[]) => key as string);
		const find = (test: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-test="${test}"]`);
		return { fixture, component: fixture.componentInstance, find };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.summary.mockReturnValue(of(connection()));
		api.sites.mockReturnValue(of([site(), site({ id: 'cloud-b', name: 'Beta', url: 'https://beta.atlassian.net', selected: false })]));
		api.projects.mockReturnValue(
			of([
				{ id: '10000', key: 'ACME', name: 'Acme' },
				{ id: '10001', key: 'WEB', name: 'Web' }
			])
		);
		api.mappings.mockReturnValue(of([]));
		api.runs.mockReturnValue(of([]));
		api.conflicts.mockReturnValue(of([]));
		api.taskTitles.mockReturnValue(of({}));
	});

	it('a connection waiting for its site offers the sites and reads nothing of a site until one is chosen', async () => {
		api.summary
			.mockReturnValueOnce(of(connection({ cloudId: null, siteName: null, siteUrl: null, siteRequired: true })))
			.mockReturnValue(of(connection({ cloudId: 'cloud-b' })));
		api.sites.mockReturnValue(of([site({ selected: false }), site({ id: 'cloud-b', name: 'Beta', selected: false })]));
		api.selectSite.mockReturnValue(of(connection({ cloudId: 'cloud-b' })));
		const { fixture, component, find } = render();
		await settle(fixture);

		expect(find('site-required')).not.toBeNull();
		expect(find('mappings')).toBeNull();
		expect(find('add-form')).toBeNull();
		expect(api.projects).not.toHaveBeenCalled();
		expect(api.mappings).not.toHaveBeenCalled();
		expect(api.runs).not.toHaveBeenCalled();

		component.siteDraft = 'cloud-b';
		component.chooseSite();
		await settle(fixture);

		expect(api.selectSite).toHaveBeenCalledWith('int-1', 'cloud-b');
		expect(api.projects).toHaveBeenCalledWith('int-1');
		expect(find('site-required')).toBeNull();
		expect(find('add-form')).not.toBeNull();
	});

	it('a connection with mappings keeps its site: the site form is locked', async () => {
		api.mappings.mockReturnValue(of([mapping()]));
		const { fixture, component, find } = render();
		await settle(fixture);

		expect(component.siteLocked()).toBe(true);
		expect(find('site-locked')).not.toBeNull();
		expect(find('choose-site')).toBeNull();
		component.siteDraft = 'cloud-b';
		component.chooseSite();
		expect(api.selectSite).not.toHaveBeenCalled();
	});

	it('offers no import for a mapping that brings no issues in (switched off, or outbound only)', async () => {
		api.mappings.mockReturnValue(of([mapping({ id: 'map-on' }), mapping({ id: 'map-off', syncEnabled: false }), mapping({ id: 'map-out', jiraProjectId: '10001', direction: 'outbound' })]));
		const { fixture, find } = render();
		await settle(fixture);
		expect((find('import-map-on') as HTMLButtonElement).disabled).toBe(false);
		expect((find('import-map-off') as HTMLButtonElement).disabled).toBe(true);
		expect((find('import-map-out') as HTMLButtonElement).disabled).toBe(true);
	});

	it('registers the webhook again and says what happened', async () => {
		api.summary.mockReturnValue(of(connection({ webhookError: 'Forbidden' })));
		api.registerWebhook.mockReturnValue(of({ outcome: 'registered', connection: connection({ webhookExpiresAt: '2026-12-12T00:00:00.000Z' }) }));
		const { fixture, component, find } = render();
		await settle(fixture);
		expect(find('webhook-error')).not.toBeNull();

		(find('register-webhook') as HTMLButtonElement).click();
		fixture.detectChanges();

		expect(api.registerWebhook).toHaveBeenCalledWith('int-1');
		expect(component.notice).toBe('JIRA.WEBHOOK.OUTCOMES.registered');
		expect(find('webhook-error')).toBeNull();
	});

	it('maps a Jira project with its status map and issue types: named statuses of that project only, blanks left out', async () => {
		api.project.mockReturnValue(
			of({
				project: { id: '10001', key: 'WEB', name: 'Web' },
				issueTypes: [
					{ id: '1', name: 'Bug', subtask: false },
					{ id: '2', name: 'Story', subtask: false }
				],
				statuses: [
					{ id: '3', name: 'In review', statusCategory: { key: 'indeterminate' } },
					{ id: '4', name: 'Blocked', statusCategory: { key: 'indeterminate' } }
				]
			})
		);
		api.createMapping.mockReturnValue(of(mapping({ id: 'map-2', jiraProjectId: '10001' })));
		const { fixture, component, find } = render();
		await settle(fixture);

		component.chooseJiraProject('10001');
		fixture.detectChanges();
		expect(api.project).toHaveBeenCalledWith('int-1', '10001');
		expect(find('named-statuses')).not.toBeNull();
		expect(find('issue-types')).not.toBeNull();

		component.draft.projectId = 'project-1';
		component.draft.categories.done = '  ';
		component.draft.named['3'] = 'review';
		component.draft.named['4'] = '';
		component.draft.named['99'] = 'from another project';
		component.toggleIssueType('2', true);
		component.add();

		expect(api.createMapping).toHaveBeenCalledWith('int-1', {
			jiraProjectId: '10001',
			jiraProjectKey: 'WEB',
			jiraProjectName: 'Web',
			projectId: 'project-1',
			direction: 'inbound',
			syncEnabled: true,
			statusMap: { new: 'open', indeterminate: 'in-progress', done: 'completed', 'status:3': 'review' },
			issueTypeIds: ['2']
		});
		// The form is empty again, and the mappings are read again.
		expect(component.draft.jiraProjectId).toBe('');
		expect(component.detail).toBeNull();
		expect(api.mappings).toHaveBeenCalledTimes(2);
	});

	it("another organization selected: goes back to the Jira overview (this connection is the former one's)", async () => {
		const organization$ = new BehaviorSubject<{ id: string; tenantId: string }>(ORGANIZATION);
		const navigate = jest.fn().mockResolvedValue(true);
		TestBed.configureTestingModule({
			imports: [JiraSettingsComponent],
			providers: [
				{ provide: JiraUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: organization$, selectedOrganization: ORGANIZATION } },
				{ provide: OrganizationProjectsService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) } },
				{ provide: Router, useValue: { navigate } },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ integrationId: 'int-1' })) } }
			]
		});
		const fixture = TestBed.createComponent(JiraSettingsComponent);
		await settle(fixture);
		expect(api.summary).toHaveBeenCalledTimes(1);

		organization$.next({ id: 'org-2', tenantId: 'tenant-1' });
		await settle(fixture);

		expect(navigate).toHaveBeenCalledWith(['/pages/integrations/jira']);
		expect(api.summary).toHaveBeenCalledTimes(1);
	});

	it("a connection of another organization than the selected one sends the page back to the overview, showing none of it", async () => {
		api.summary.mockReturnValue(of(connection({ organizationId: 'org-other' })));
		const { fixture, component } = render();
		const navigate = TestBed.inject(Router).navigate as jest.Mock;
		await settle(fixture);
		expect(navigate).toHaveBeenCalledWith(['/pages/integrations/jira']);
		expect(component.connection).toBeNull();
		expect(component.mappings).toEqual([]);
	});

	it('a run count opens the open conflicts of that run, whatever the list showed before', async () => {
		api.runs.mockReturnValue(of([run({ id: 'run-5', conflictCount: 2 })]));
		const { fixture, component } = render();
		await settle(fixture);
		const list = (component as unknown as { conflictList: { showOpen: () => void } }).conflictList;
		const showOpen = jest.spyOn(list, 'showOpen');
		component.showRunConflicts(component.runs[0]);
		expect(component.conflictRunId).toBe('run-5');
		expect(showOpen).toHaveBeenCalled();
	});

	it('a project detail answered after the form moved to another Jira project is dropped', async () => {
		const late = new Subject<never>();
		api.project.mockReturnValueOnce(late).mockReturnValueOnce(of({ project: { id: '10000', key: 'ACME', name: 'Acme' }, issueTypes: [], statuses: [] }));
		const { fixture, component } = render();
		await settle(fixture);

		component.chooseJiraProject('10001');
		component.chooseJiraProject('10000');

		expect(component.detail?.project.id).toBe('10000');
		expect(late.observed).toBe(false);
	});

	it("shows a run's report: its counts, whether it stopped early, and the issues it could not apply", async () => {
		api.runs.mockReturnValue(
			of([
				run({
					id: 'run-7',
					status: 'failed',
					failedCount: 7,
					report: {
						startedFrom: null,
						stoppedAt: '2026-11-11T08:00:00.000Z',
						complete: false,
						pages: 2,
						issuesRead: 80,
						comments: 12,
						links: 3,
						relations: 1,
						conflicts: 0,
						failures: Array.from({ length: 6 }, (_, index) => ({ key: `ACME-${index + 1}`, error: 'Refused' })),
						moreFailures: 1
					}
				})
			])
		);
		const { fixture, component, find } = render();
		await settle(fixture);

		expect(find('report-partial')).not.toBeNull();
		const failures = find('report-failures-run-7') as HTMLElement;
		expect(failures.querySelectorAll('.failure')).toHaveLength(5);
		expect(component.hiddenFailures(component.runs[0])).toBe(2);
	});
});
