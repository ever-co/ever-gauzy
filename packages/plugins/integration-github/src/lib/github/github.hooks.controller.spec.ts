// The services are injected by type only: their own module graphs (Probot, Octokit, the platform) stay out of this suite.
jest.mock('./github.hooks.service', () => ({ GithubHooksService: class GithubHooksService {} }));
jest.mock('./github-task-link.service', () => ({ GithubTaskLinkService: class GithubTaskLinkService {} }));

import 'reflect-metadata';
import { GitHubHooksController } from './github.hooks.controller';

/** The closed pull requests and issues GitHub delivers reach the report of linked tasks (spec `task-automations`, T16). */
describe('GitHubHooksController — closed pull requests and issues', () => {
	const setup = () => {
		const links = { pullRequestClosed: jest.fn(async () => 1), issueClosed: jest.fn(async () => 1) };
		const controller = new GitHubHooksController({} as never, links as never);
		return { controller, links };
	};

	it('hands a closed pull request to the report with its delivery id, a bot’s close too (a merge queue merges as one)', async () => {
		const { controller, links } = setup();
		const payload = { action: 'closed', pull_request: { id: 1 } };
		await controller.pullRequestClosed({ id: 'delivery-1', isBot: true, payload } as never);
		expect(links.pullRequestClosed).toHaveBeenCalledWith('delivery-1', payload);
	});

	it('hands a closed issue to the report with its delivery id', async () => {
		const { controller, links } = setup();
		const payload = { action: 'closed', issue: { id: 2 } };
		await controller.issuesClosed({ id: 'delivery-2', isBot: false, payload } as never);
		expect(links.issueClosed).toHaveBeenCalledWith('delivery-2', payload);
	});
});
