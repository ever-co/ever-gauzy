import { IntegrationMapSyncIssueCommand } from '@gauzy/core';
import { GithubSyncService } from './github-sync.service';

/**
 * A GitHub issue sync ends by recording itself (`integrationSyncCompleted`).
 *
 * `syncingGithubIssues` is where both the manual sync and the automatic one finish, and it ended by stamping the
 * connection's `lastSyncedAt` on its own and announcing nothing: no `integration_tenant.synced` fact existed for
 * `Subscription.integrationSyncCompleted` to follow. It now ends through
 * `IntegrationTenantSyncService.recordSyncCompleted`, which stamps and announces in one transaction — for the run's
 * own tenant and organization, with the count of issues it synchronised — and a run that fails does not reach it.
 */
describe('GithubSyncService.syncingGithubIssues — the end of a run is recorded', () => {
	const issue = (id: number) => ({ id, number: id, title: `Issue ${id}`, state: 'open', body: '' });
	const input = {
		organizationId: 'org-1',
		tenantId: 'tenant-1',
		repository: { repositoryId: 4242, private: false },
		issues: [issue(1), issue(2)]
	};

	const setup = (execute: jest.Mock) => {
		const recordSyncCompleted = jest.fn(async () => undefined);
		const integrationTenantService = {
			findOneByIdString: jest.fn(async () => ({ entitySettings: [{ entity: 'Issue', sync: true, tiedEntities: [] }] })),
			update: jest.fn()
		};
		const service = new GithubSyncService(
			{ execute } as never,
			{} as never,
			integrationTenantService as never,
			{} as never,
			{} as never,
			{ recordSyncCompleted } as never
		);
		return { service, recordSyncCompleted, integrationTenantService };
	};

	it('records a finished run once, for the run’s own tenant and organization, with the issues it synchronised', async () => {
		const execute = jest.fn(async (command: unknown) =>
			command instanceof IntegrationMapSyncIssueCommand ? { id: `map-${execute.mock.calls.length}` } : undefined
		);
		const { service, recordSyncCompleted, integrationTenantService } = setup(execute);
		const success = jest.fn();

		const maps = await service.syncingGithubIssues('integration-1', input as never, 0, success);

		expect(maps).toHaveLength(2);
		expect(recordSyncCompleted).toHaveBeenCalledTimes(1);
		expect(recordSyncCompleted).toHaveBeenCalledWith('integration-1', {
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			counts: { issue: 2 }
		});
		// The stamp is the recording's, in its transaction — not a second, unannounced write beside it.
		expect(integrationTenantService.update).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith(true);
	});

	it('records nothing for a run that failed part-way, and reports the failure', async () => {
		const execute = jest.fn(async (command: unknown) => {
			if (command instanceof IntegrationMapSyncIssueCommand) throw new Error('the task could not be written');
			return undefined;
		});
		const { service, recordSyncCompleted } = setup(execute);
		const failure = jest.fn();

		await expect(service.syncingGithubIssues('integration-1', input as never, 0, undefined, failure)).resolves.toBe(false);

		expect(recordSyncCompleted).not.toHaveBeenCalled();
		expect(failure).toHaveBeenCalledWith(false);
	});

	it('reports a run whose completion could not be recorded as not finished', async () => {
		const execute = jest.fn(async () => ({ id: 'map' }));
		const { service, recordSyncCompleted } = setup(execute);
		recordSyncCompleted.mockRejectedValueOnce(new Error('the outbox is unavailable'));
		const success = jest.fn();
		const failure = jest.fn();

		await expect(service.syncingGithubIssues('integration-1', input as never, 0, success, failure)).resolves.toBe(false);

		expect(success).not.toHaveBeenCalled();
		expect(failure).toHaveBeenCalledWith(false);
	});
});
