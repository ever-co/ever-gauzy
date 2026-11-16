import { IGithubIssue, IOrganizationGithubRepository } from '@gauzy/contracts';
import { GithubService } from './github.service';

/**
 * The manual issue sync posts a trimmed copy of each selected issue. The copy lost the `pull_request` marker of the
 * repository issues list, so the server could not tell a pull request from an issue and synced it as a task.
 */
describe('GithubService.manualSyncIssues — the issue payload', () => {
	const issue = (id: number, extra: Record<string, unknown> = {}) =>
		({ id, number: id, title: `Item ${id}`, state: 'open', body: 'text', labels: [], ...extra }) as IGithubIssue;

	const post = async (issues: IGithubIssue[]) => {
		const http = { post: jest.fn(() => ({ subscribe: jest.fn() })) };
		const service = new GithubService(http as never);

		service.manualSyncIssues('integration-1', { id: 'repo-1' } as IOrganizationGithubRepository, {
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			issues
		});

		const [, body] = http.post.mock.calls[0] as unknown as [string, { issues: Record<string, unknown>[] }];
		return body.issues;
	};

	it('keeps the pull request marker of a pull request', async () => {
		const marker = { url: 'https://example.com/pulls/2' };

		const [mapped] = await post([issue(2, { pull_request: marker, node_id: 'dropped' })]);

		expect(mapped).toEqual({
			id: 2,
			number: 2,
			title: 'Item 2',
			state: 'open',
			body: 'text',
			labels: [],
			pull_request: marker
		});
	});

	it('leaves the payload of a plain issue as it was', async () => {
		const [mapped] = await post([issue(1)]);

		expect(mapped).toEqual({ id: 1, number: 1, title: 'Item 1', state: 'open', body: 'text', labels: [] });
		expect('pull_request' in mapped).toBe(false);
	});
});
