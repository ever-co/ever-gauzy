import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubViewComponent } from './view.component';
import { IntegrationGithubUiModule } from '../../integration-github-ui.module';
import { PipesModule } from '@gauzy/ui-core/shared';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { of } from 'rxjs';
import { SyncTags } from '@gauzy/constants';
import { GithubService, OrganizationProjectsService, ToastrService } from '@gauzy/ui-core/core';
import { GithubProjectSyncSettingsComponent } from '../project-sync-settings/project-sync-settings.component';

/** A child of the GitHub layout route (integration-github.routes.ts): the parent resolves the integration tenant,
 * and the child path carries `:integrationId`. */
const activatedRouteStub = {
	parent: { data: of({ integration: { id: 'integration-1', name: 'Github' } }) },
	snapshot: {
		data: { selectors: false },
		params: { integrationId: 'integration-1' },
		queryParams: {}
	},
	data: of({ selectors: false }),
	params: of({ integrationId: 'integration-1' }),
	queryParams: of({})
};

describe('GithubViewComponent', () => {
	let component: GithubViewComponent;
	let fixture: ComponentFixture<GithubViewComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it. PipesModule provides the pipes it injects
			// (the app gets them from its root imports).
			imports: [IntegrationGithubUiModule, PipesModule],
			providers: [{ provide: ActivatedRoute, useValue: activatedRouteStub }],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(GithubViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});

/**
 * Syncing a repository links the project to it. That used to store the default sync label on the project every time,
 * overwriting a label the project had chosen (#7083); it now keeps the project's label, and stores the default one
 * only for a project without a label.
 */
describe('GithubViewComponent — the project sync label', () => {
	let component: GithubViewComponent;
	let githubService: Record<string, jest.Mock>;
	let organizationProjectsService: Record<string, jest.Mock>;
	let dialogService: { open: jest.Mock };

	const setup = async (storedSyncTag: string | null) => {
		githubService = {
			syncGithubRepository: jest.fn(() => of({ id: 'organization-repository-1' })),
			autoSyncIssues: jest.fn(() => of(true)),
			manualSyncIssues: jest.fn(() => of(true)),
			getRepositoryIssues: jest.fn(() => of([]))
		};
		organizationProjectsService = {
			getById: jest.fn(() => of({ id: 'project-1', syncTag: storedSyncTag })),
			updateProjectSetting: jest.fn((id: string) => of({ id })),
			findSyncedProjects: jest.fn(() => of({ items: [], total: 0 }))
		};
		dialogService = { open: jest.fn(() => ({ onClose: of({ id: 'project-1', syncTag: 'needs-gauzy' }) })) };

		await TestBed.configureTestingModule({
			imports: [IntegrationGithubUiModule, PipesModule],
			providers: [
				{ provide: ActivatedRoute, useValue: activatedRouteStub },
				{ provide: GithubService, useValue: githubService },
				{ provide: OrganizationProjectsService, useValue: organizationProjectsService },
				{ provide: ToastrService, useValue: { success: jest.fn() } },
				{ provide: NbDialogService, useValue: dialogService }
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();

		component = TestBed.createComponent(GithubViewComponent).componentInstance;
		component.organization = { id: 'org-1', tenantId: 'tenant-1' } as never;
		component.integration = { id: 'integration-1' } as never;
		component.repository = { id: 4242, name: 'ever-gauzy', full_name: 'ever-co/ever-gauzy' } as never;
		// The project as the project selector hands it over: without its sync settings.
		component.project = { id: 'project-1', name: 'Gauzy Web' } as never;
	};

	const linkedWith = (syncTag: string) => ({
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		customFields: { repositoryId: 'organization-repository-1' },
		syncTag
	});

	it('keeps the label the project chose when auto-syncing the repository', async () => {
		await setup('needs-gauzy');

		component.autoSyncIssues();

		expect(organizationProjectsService.getById).toHaveBeenCalledWith('project-1');
		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledTimes(1);
		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith('project-1', linkedWith('needs-gauzy'));
		expect(githubService.autoSyncIssues).toHaveBeenCalled();
	});

	it('keeps the label the project chose when manually syncing issues', async () => {
		await setup('needs-gauzy');

		component.manualSyncIssues();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith('project-1', linkedWith('needs-gauzy'));
		expect(githubService.manualSyncIssues).toHaveBeenCalled();
	});

	it.each([null, '', '  '])('stores the default label for a project without one (%p), as before', async (syncTag) => {
		await setup(syncTag);

		component.autoSyncIssues();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith(
			'project-1',
			linkedWith(SyncTags.GAUZY)
		);
	});

	it('opens a project’s sync settings and refreshes the synced projects once they are saved', async () => {
		await setup('needs-gauzy');
		const project = { id: 'project-1', name: 'Gauzy Web' } as never;
		const refreshed = jest.fn();
		component.subject$.subscribe(refreshed);
		refreshed.mockClear();

		component.openProjectSyncSettings(project);

		expect(dialogService.open).toHaveBeenCalledWith(GithubProjectSyncSettingsComponent, {
			context: { project, integration: component.integration }
		});
		expect(refreshed).toHaveBeenCalledWith(true);
	});

	it('does not refresh when the sync settings are cancelled', async () => {
		await setup('needs-gauzy');
		dialogService.open.mockReturnValueOnce({ onClose: of(undefined) });
		const refreshed = jest.fn();
		component.subject$.subscribe(refreshed);
		refreshed.mockClear();

		component.openProjectSyncSettings({ id: 'project-1' } as never);

		expect(refreshed).not.toHaveBeenCalled();
	});
});
