import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyncTags } from '@gauzy/constants';
import { IOrganizationProject } from '@gauzy/contracts';
import { GithubProjectSyncLabelComponent } from './project-sync-label.component';

describe('GithubProjectSyncLabelComponent', () => {
	let fixture: ComponentFixture<GithubProjectSyncLabelComponent>;
	let component: GithubProjectSyncLabelComponent;

	const render = async (project: Partial<IOrganizationProject>): Promise<string> => {
		await TestBed.configureTestingModule({
			imports: [GithubProjectSyncLabelComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();

		fixture = TestBed.createComponent(GithubProjectSyncLabelComponent);
		component = fixture.componentInstance;
		component.rowData = { id: 'project-1', name: 'Gauzy Web', ...project } as IOrganizationProject;
		fixture.detectChanges();
		return fixture.nativeElement.textContent.trim();
	};

	it('shows the label the project chose', async () => {
		const text = await render({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: true, syncTag: ' needs-gauzy ' });

		expect(fixture.nativeElement.querySelector('.project-sync-label__tag').textContent.trim()).toBe('needs-gauzy');
		expect(text).toContain('needs-gauzy');
	});

	it('shows the default label for a project without one', async () => {
		await render({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: true, syncTag: null });

		expect(fixture.nativeElement.querySelector('.project-sync-label__tag').textContent.trim()).toBe(SyncTags.GAUZY);
	});

	it('says every issue syncs when the project does not filter on a label', async () => {
		const text = await render({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: false, syncTag: 'needs-gauzy' });

		expect(fixture.nativeElement.querySelector('.project-sync-label__tag')).toBeNull();
		expect(text).toContain('INTEGRATIONS.GITHUB_PAGE.PROJECT_SYNC.ALL_ISSUES');
	});

	it('says auto-sync is off when the project does not auto-sync', async () => {
		const text = await render({ isTasksAutoSync: false, isTasksAutoSyncOnLabel: true, syncTag: 'needs-gauzy' });

		expect(text).toContain('INTEGRATIONS.GITHUB_PAGE.PROJECT_SYNC.AUTO_SYNC_OFF');
	});

	it('asks for the project’s sync settings from its edit button', async () => {
		await render({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: true, syncTag: 'needs-gauzy' });
		const edited = jest.fn();
		component.edit.subscribe(edited);

		fixture.nativeElement.querySelector('button.project-sync-label__edit').click();

		expect(edited).toHaveBeenCalledWith(component.rowData);
	});
});
