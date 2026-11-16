import { IntegrationMapSyncIssueCommand } from '@gauzy/core';
import { GithubSyncService } from './github-sync.service';

/**
 * The repository issues list of GitHub holds pull requests as well as issues. A sync that took the list as it came
 * turned every pull request of the repository into a task, although the webhook path only ever syncs issues.
 */
describe('GithubSyncService — pull requests are not synced as tasks', () => {
	const issue = (id: number, extra: Record<string, unknown> = {}) => ({
		id,
		number: id,
		title: `Item ${id}`,
		state: 'open',
		body: '',
		labels: [],
		...extra
	});
	const pullRequest = (id: number) => issue(id, { pull_request: { url: `https://example.com/pulls/${id}` } });

	describe('syncingGithubIssues', () => {
		const setup = () => {
			const execute = jest.fn(async (command: unknown) =>
				command instanceof IntegrationMapSyncIssueCommand ? { id: 'map' } : undefined
			);
			const recordSyncCompleted = jest.fn(async () => undefined);
			const integrationTenantService = {
				findOneByIdString: jest.fn(async () => ({
					entitySettings: [{ entity: 'Issue', sync: true, tiedEntities: [] }]
				}))
			};
			const service = new GithubSyncService(
				{ execute } as never,
				{} as never,
				integrationTenantService as never,
				{} as never,
				{} as never,
				{ recordSyncCompleted } as never
			);
			return { service, execute, recordSyncCompleted };
		};

		it('maps the issues of the list and leaves its pull requests out', async () => {
			const { service, execute, recordSyncCompleted } = setup();
			const input = {
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				repository: { repositoryId: 1, private: false },
				issues: [issue(1), pullRequest(2), issue(3)]
			};

			const maps = await service.syncingGithubIssues('integration-1', input as never, 0);

			const mapped = execute.mock.calls
				.map(([command]) => command)
				.filter((command): command is IntegrationMapSyncIssueCommand => command instanceof IntegrationMapSyncIssueCommand)
				.map((command) => command.request.sourceId);
			expect(mapped).toEqual(['1', '3']);
			expect(maps).toHaveLength(2);
			expect(recordSyncCompleted).toHaveBeenCalledWith(
				'integration-1',
				expect.objectContaining({ counts: { issue: 2 } })
			);
		});

		it('still syncs a list that holds no pull request in full', async () => {
			const { service } = setup();
			const input = {
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				repository: { repositoryId: 1, private: false },
				issues: [issue(1), issue(2)]
			};

			await expect(service.syncingGithubIssues('integration-1', input as never, 0)).resolves.toHaveLength(2);
		});
	});

	describe('getRepositoryAllIssues', () => {
		it('returns the issues of every page without the pull requests', async () => {
			const pages = [Array.from({ length: 100 }, (_, i) => (i % 2 ? pullRequest(i + 1) : issue(i + 1))), [issue(500)]];
			const getRepositoryIssues = jest.fn(async (_installationId: number, { page }: { page: number }) => ({
				data: pages[page - 1] ?? []
			}));
			const service = new GithubSyncService(
				{} as never,
				{ getRepositoryIssues } as never,
				{} as never,
				{} as never,
				{} as never,
				{} as never
			);

			const issues = await service.getRepositoryAllIssues(1, 'acme', 'site');

			// A full first page still means "ask for the next one", although half of it was pull requests.
			expect(getRepositoryIssues).toHaveBeenCalledTimes(2);
			expect(issues).toHaveLength(51);
			expect(issues.some((item) => 'pull_request' in item)).toBe(false);
		});
	});
});
