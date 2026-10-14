import { IntegrationEntity } from '@gauzy/contracts';
import { AutomationTaskSyncCommand } from '@gauzy/core';
import { GithubSyncService } from './github-sync.service';

/**
 * A GitHub issue webhook must create / update the task in every project linked to the repository with
 * task auto-sync on. The sync returned from inside its loops after the first task, so only the first
 * project (and only the first issue of a batch) was synced.
 */
describe('GithubSyncService.syncAutomationIssue', () => {
	const integration = {
		id: 'integration-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		entitySettings: [{ entity: IntegrationEntity.ISSUE, sync: true, tiedEntities: [] }]
	};
	const repository = { id: 'repository-1', private: false };
	const project = (id: string) => ({ id, name: `Project ${id}`, isTasksAutoSync: true, isTasksAutoSyncOnLabel: false });
	const issue = (id: number) => ({ id, number: id, title: `Issue ${id}`, state: 'open', body: '', labels: [] });

	const sync = async (issues: unknown) => {
		const execute = jest.fn().mockResolvedValue({});
		const self = Object.assign(Object.create(GithubSyncService.prototype), {
			_organizationProjectService: {
				getProjectsByGithubRepository: jest.fn().mockResolvedValue([project('project-a'), project('project-b')])
			},
			_commandBus: { execute },
			logger: { error: jest.fn() }
		});
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		await GithubSyncService.prototype.syncAutomationIssue.call(self, { integration, repository, issue: issues });

		return execute.mock.calls
			.map(([command]) => command)
			.filter((command) => command instanceof AutomationTaskSyncCommand)
			.map((command: AutomationTaskSyncCommand) => [command.input.entity.projectId, command.input.sourceId]);
	};

	afterEach(() => jest.restoreAllMocks());

	it('syncs the issue as a task in every linked project', async () => {
		expect(await sync(issue(1))).toEqual([
			['project-a', '1'],
			['project-b', '1']
		]);
	});

	it('syncs every issue of a batch', async () => {
		expect(await sync([issue(1), issue(2)])).toEqual([
			['project-a', '1'],
			['project-a', '2'],
			['project-b', '1'],
			['project-b', '2']
		]);
	});
});
