// The stores are the spec's own: the real `@gauzy/ui-core/core` loads the whole app shell.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, OrganizationProjectsService: class OrganizationProjectsService {} }));

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { OrganizationProjectsService, Store } from '@gauzy/ui-core/core';
import { AsanaRun, AsanaUiService } from '../../services/asana-ui.service';
import { AsanaSettingsComponent } from './asana-settings.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

/** The first load waits on the projects (a promise); the page's runs poll keeps the zone from ever being stable. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
	fixture.detectChanges();
	await new Promise((resolve) => setTimeout(resolve, 0));
	fixture.detectChanges();
}

function run(overrides: Partial<AsanaRun> = {}): AsanaRun {
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
describe('AsanaSettingsComponent (sync log and conflicts)', () => {
	const api = {
		summary: jest.fn(),
		status: jest.fn(),
		metadata: jest.fn(),
		mappings: jest.fn(),
		runs: jest.fn(),
		conflicts: jest.fn(),
		resolveConflict: jest.fn(),
		taskTitle: jest.fn()
	};

	function render() {
		TestBed.configureTestingModule({
			imports: [AsanaSettingsComponent],
			providers: [
				{ provide: AsanaUiService, useValue: api },
				{ provide: Store, useValue: { selectedOrganization$: of(ORGANIZATION), selectedOrganization: ORGANIZATION } },
				{ provide: OrganizationProjectsService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) } },
				{ provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ integrationId: 'int-1' })) } }
			]
		});
		const fixture = TestBed.createComponent(AsanaSettingsComponent);
		return fixture;
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.summary.mockReturnValue(of({ id: 'int-1', organizationId: 'org-1', asanaUserName: 'Ada', attentionReason: null, createdAt: null }));
		api.status.mockReturnValue(of({ configured: true, webhooks: false, connection: null }));
		api.metadata.mockReturnValue(of({ workspaces: [] }));
		api.mappings.mockReturnValue(of([]));
		api.runs.mockReturnValue(of([run(), run({ id: 'run-2', conflictCount: 3 })]));
		api.conflicts.mockReturnValue(of([]));
		api.taskTitle.mockReturnValue(of(null));
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
		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: null });

		count.click();
		fixture.detectChanges();

		expect(fixture.componentInstance.conflictRunId).toBe('run-2');
		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'open', runId: 'run-2' });
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
});
