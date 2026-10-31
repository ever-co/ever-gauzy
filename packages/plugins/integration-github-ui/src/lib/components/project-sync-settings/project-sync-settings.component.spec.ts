import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { Observable, of, throwError } from 'rxjs';
import { SyncTags } from '@gauzy/constants';
import { GITHUB_LABEL_NAME_MAX_LENGTH } from '@gauzy/contracts';
import { ErrorHandlingService, GithubService, OrganizationProjectsService, ToastrService } from '@gauzy/ui-core/core';
import {
	GITHUB_LABEL_SUGGESTION_ISSUES,
	GithubProjectSyncSettingsComponent,
	githubLabelNameValidator
} from './project-sync-settings.component';

/**
 * The GitHub page's per-project sync settings (#7083): the label a project syncs on, picked from the repository's
 * labels or typed, saved through the existing project-setting endpoint.
 */
describe('GithubProjectSyncSettingsComponent', () => {
	const repository = { id: 'repository-1', owner: 'ever-co', name: 'ever-gauzy', fullName: 'ever-co/ever-gauzy' };
	const baseProject = {
		id: 'project-1',
		name: 'Gauzy Web',
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		isTasksAutoSync: true,
		isTasksAutoSyncOnLabel: true,
		syncTag: 'needs-gauzy',
		customFields: { repository }
	};
	const integration = { id: 'integration-1' };
	const issues = [{ labels: [{ name: 'bug' }, { name: 'Gauzy' }] }, { labels: [{ name: 'enhancement' }] }];

	let fixture: ComponentFixture<GithubProjectSyncSettingsComponent>;
	let component: GithubProjectSyncSettingsComponent;
	let githubService: { getRepositoryIssues: jest.Mock };
	let organizationProjectsService: { updateProjectSetting: jest.Mock };
	let toastrService: { success: jest.Mock };
	let errorHandlingService: { handleError: jest.Mock };
	let dialogRef: { close: jest.Mock };

	const latest = <T>(observable: Observable<T>): T => {
		let value: T;
		observable.subscribe((emitted) => (value = emitted)).unsubscribe();
		return value;
	};

	const create = async (project: Record<string, unknown> = {}, issues$: Observable<unknown> = of(issues)) => {
		githubService = { getRepositoryIssues: jest.fn(() => issues$) };
		organizationProjectsService = {
			updateProjectSetting: jest.fn((id: string, setting: object) => of({ id, ...setting }))
		};
		toastrService = { success: jest.fn() };
		errorHandlingService = { handleError: jest.fn() };
		dialogRef = { close: jest.fn() };

		await TestBed.configureTestingModule({
			imports: [GithubProjectSyncSettingsComponent],
			providers: [
				{ provide: GithubService, useValue: githubService },
				{ provide: OrganizationProjectsService, useValue: organizationProjectsService },
				{ provide: ToastrService, useValue: toastrService },
				{ provide: ErrorHandlingService, useValue: errorHandlingService },
				{ provide: NbDialogRef, useValue: dialogRef }
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();

		fixture = TestBed.createComponent(GithubProjectSyncSettingsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('project', { ...baseProject, ...project });
		fixture.componentRef.setInput('integration', integration);
		fixture.detectChanges();
	};

	it('opens with the project settings', async () => {
		await create();

		expect(component.form.getRawValue()).toEqual({
			isTasksAutoSync: true,
			isTasksAutoSyncOnLabel: true,
			syncTag: 'needs-gauzy'
		});
		const input: HTMLInputElement = fixture.nativeElement.querySelector('#github-project-sync-label');
		expect(input.value).toBe('needs-gauzy');
		expect(input.placeholder).toBe(SyncTags.GAUZY);
	});

	it('saves the label the user chose, trimmed, and closes with the saved setting', async () => {
		await create();
		component.form.controls.syncTag.setValue('  type: sync  ');

		component.save();

		const setting = {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			isTasksAutoSync: true,
			isTasksAutoSyncOnLabel: true,
			syncTag: 'type: sync'
		};
		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith('project-1', setting);
		expect(toastrService.success).toHaveBeenCalledWith('INTEGRATIONS.GITHUB_PAGE.PROJECT_SYNC.SAVED', {
			project: 'Gauzy Web'
		});
		expect(dialogRef.close).toHaveBeenCalledWith({ id: 'project-1', ...setting });
	});

	it('saves the default label when the label is left empty', async () => {
		await create();
		component.form.controls.syncTag.setValue('   ');

		component.save();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith(
			'project-1',
			expect.objectContaining({ isTasksAutoSyncOnLabel: true, syncTag: SyncTags.GAUZY })
		);
	});

	it('opens a project without a label on an empty field that stands for the default label', async () => {
		await create({ syncTag: null });

		expect(component.form.controls.syncTag.value).toBe('');
		component.save();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith(
			'project-1',
			expect.objectContaining({ syncTag: SyncTags.GAUZY })
		);
	});

	it('leaves the stored label alone when the project syncs every issue', async () => {
		await create();
		component.form.controls.syncTag.setValue('x'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH + 1));
		component.form.controls.isTasksAutoSyncOnLabel.setValue(false);
		fixture.detectChanges();

		// The hidden label field neither blocks saving nor is sent.
		expect(fixture.nativeElement.querySelector('#github-project-sync-label')).toBeNull();
		expect(component.form.valid).toBe(true);
		component.save();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith('project-1', {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			isTasksAutoSync: true,
			isTasksAutoSyncOnLabel: false
		});
	});

	it('saves auto-sync turned off', async () => {
		await create();
		component.form.controls.isTasksAutoSync.setValue(false);

		component.save();

		expect(organizationProjectsService.updateProjectSetting).toHaveBeenCalledWith(
			'project-1',
			expect.objectContaining({ isTasksAutoSync: false })
		);
	});

	it('refuses a label GitHub would not accept', async () => {
		await create();
		component.form.controls.syncTag.setValue('x'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH + 1));
		fixture.detectChanges();

		expect(component.form.invalid).toBe(true);
		expect(fixture.nativeElement.querySelector('.setting__error')).not.toBeNull();
		const save: HTMLButtonElement = fixture.nativeElement.querySelector('nb-card-footer button[status="primary"]');
		expect(save.disabled).toBe(true);

		component.save();
		expect(organizationProjectsService.updateProjectSetting).not.toHaveBeenCalled();
	});

	it('offers the labels of the repository’s open issues after the default and the project’s own', async () => {
		await create();

		expect(githubService.getRepositoryIssues).toHaveBeenCalledWith('integration-1', 'ever-co', 'ever-gauzy', {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			page: 1,
			per_page: GITHUB_LABEL_SUGGESTION_ISSUES
		});
		expect(latest(component.filteredLabels$)).toEqual(['Gauzy', 'needs-gauzy', 'bug', 'enhancement']);
	});

	it('narrows the offered labels to what is typed', async () => {
		await create();

		component.form.controls.syncTag.setValue('EN');

		expect(latest(component.filteredLabels$)).toEqual(['enhancement']);
	});

	it('still offers the default label and the project’s own when the repository labels cannot be read', async () => {
		await create(
			{},
			throwError(() => new Error('GitHub is unavailable'))
		);

		expect(latest(component.filteredLabels$)).toEqual(['Gauzy', 'needs-gauzy']);
		expect(errorHandlingService.handleError).not.toHaveBeenCalled();
	});

	it('does not ask GitHub for labels when the project has no repository', async () => {
		await create({ customFields: {} });

		expect(githubService.getRepositoryIssues).not.toHaveBeenCalled();
		expect(latest(component.filteredLabels$)).toEqual(['Gauzy', 'needs-gauzy']);
	});

	it('keeps the dialog open and reports the error when saving fails', async () => {
		await create();
		organizationProjectsService.updateProjectSetting.mockReturnValueOnce(throwError(() => new Error('Forbidden')));

		component.save();

		expect(errorHandlingService.handleError).toHaveBeenCalled();
		expect(dialogRef.close).not.toHaveBeenCalled();
		expect(component.saving).toBe(false);
	});

	it('closes without a result on cancel', async () => {
		await create();

		component.cancel();

		expect(dialogRef.close).toHaveBeenCalledWith();
		expect(organizationProjectsService.updateProjectSetting).not.toHaveBeenCalled();
	});
});

describe('githubLabelNameValidator', () => {
	const validate = (value: unknown) => githubLabelNameValidator({ value } as never);

	it('accepts an empty label (the default one applies)', () => {
		expect(validate('')).toBeNull();
		expect(validate('   ')).toBeNull();
		expect(validate(null)).toBeNull();
	});

	it('accepts a label GitHub accepts', () => {
		expect(validate('needs-gauzy')).toBeNull();
	});

	it('refuses a label GitHub refuses', () => {
		expect(validate('x'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH + 1))).toEqual({ githubLabelName: true });
		expect(validate('two\nlines')).toEqual({ githubLabelName: true });
	});
});
