import { SyncTags } from '@gauzy/constants';
import { IntegrationEntity } from '@gauzy/contracts';
import { AutomationTaskSyncCommand } from '@gauzy/core';
import { GithubSyncService } from './github-sync.service';

/**
 * The webhook automation turns a GitHub issue into a task of every project mapped to its repository. A project that
 * syncs only labelled issues matches them on its own label (`syncTag`), or on the default label when it has none
 * (#7083): the GitHub page used to overwrite the label with the default one on every repository sync, and a project
 * without a label made the match throw (`syncTag.trim()` of `null`), so its issues were never synced.
 */
describe('GithubSyncService.syncAutomationIssue — the project sync label', () => {
	const integration = {
		id: 'integration-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		entitySettings: [{ entity: IntegrationEntity.ISSUE, sync: true, tiedEntities: [] }]
	};
	const repository = { id: 'repository-1', repositoryId: 4242, private: false };
	const issueWith = (...labels: string[]) => ({
		id: 7,
		number: 7,
		title: 'Issue 7',
		state: 'open',
		body: '',
		labels: labels.map((name, index) => ({ id: index + 1, name }))
	});
	const project = (settings: Record<string, unknown>) => ({
		id: 'project-1',
		name: 'Gauzy',
		isTasksAutoSync: true,
		isTasksAutoSyncOnLabel: true,
		...settings
	});

	/** Runs the automation for one issue and one mapped project; returns the tasks it synced (their project ids). */
	const syncedProjectIds = async (mapped: Record<string, unknown>, issue: ReturnType<typeof issueWith>) => {
		const execute = jest.fn(async (_command: unknown) => ({}));
		const organizationProjectService = { getProjectsByGithubRepository: jest.fn(async () => [mapped]) };
		const service = new GithubSyncService(
			{ execute } as never,
			{} as never,
			{} as never,
			organizationProjectService as never,
			{} as never,
			{} as never
		);

		await service.syncAutomationIssue({ integration, repository, issue } as never);

		return execute.mock.calls
			.map(([command]) => command)
			.filter((command): command is AutomationTaskSyncCommand => command instanceof AutomationTaskSyncCommand)
			.map((command) => command.input.entity.projectId);
	};

	it('syncs an issue that carries the label the project chose', async () => {
		await expect(
			syncedProjectIds(project({ syncTag: 'needs-gauzy' }), issueWith('bug', 'needs-gauzy'))
		).resolves.toEqual(['project-1']);
	});

	it('matches the chosen label once trimmed', async () => {
		await expect(
			syncedProjectIds(project({ syncTag: ' needs-gauzy ' }), issueWith('needs-gauzy'))
		).resolves.toEqual(['project-1']);
	});

	it('does not sync an issue that only carries the default label when the project chose another one', async () => {
		await expect(syncedProjectIds(project({ syncTag: 'needs-gauzy' }), issueWith(SyncTags.GAUZY))).resolves.toEqual(
			[]
		);
	});

	it.each([null, undefined, '', '  '])(
		'syncs an issue carrying the default label when the project has no label of its own (%p)',
		async (syncTag) => {
			await expect(syncedProjectIds(project({ syncTag }), issueWith(SyncTags.GAUZY))).resolves.toEqual([
				'project-1'
			]);
		}
	);

	it('keeps the default label working as before for a project that stores it', async () => {
		await expect(
			syncedProjectIds(project({ syncTag: SyncTags.GAUZY }), issueWith(SyncTags.GAUZY))
		).resolves.toEqual(['project-1']);
		await expect(syncedProjectIds(project({ syncTag: SyncTags.GAUZY }), issueWith('bug'))).resolves.toEqual([]);
	});

	it('syncs every issue when the project does not filter on a label', async () => {
		await expect(
			syncedProjectIds(project({ isTasksAutoSyncOnLabel: false, syncTag: 'needs-gauzy' }), issueWith('bug'))
		).resolves.toEqual(['project-1']);
	});

	it('syncs nothing when the project does not auto-sync', async () => {
		await expect(
			syncedProjectIds(project({ isTasksAutoSync: false, syncTag: 'needs-gauzy' }), issueWith('needs-gauzy'))
		).resolves.toEqual([]);
	});
});
