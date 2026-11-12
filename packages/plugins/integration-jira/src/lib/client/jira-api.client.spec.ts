// cspell:ignore issuetype issuelinks
import { accessibleJiraSites, errorMessageOf, exchangeJiraCode, JiraApiClient, JiraApiError, refreshJiraToken, retryAfterSecondsOf } from './jira-api.client';

type Answer = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(answers: Answer[]) {
	const calls: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }> = [];
	const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
		calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
		const answer = answers.shift() ?? { status: 204 };
		return {
			status: answer.status,
			headers: { get: (name: string) => answer.headers?.[name] ?? null },
			text: async () => (answer.body === undefined ? '' : typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body))
		};
	};
	return { fetchImpl, calls };
}

const client = (answers: Answer[]) => {
	const fake = fakeFetch(answers);
	return { ...fake, api: new JiraApiClient('tok', 'cloud-1', { fetchImpl: fake.fetchImpl as never, apiUrl: 'https://gateway.test/' }) };
};

describe('JiraApiClient', () => {
	it('calls the site through the gateway with the token as a bearer', async () => {
		const { api, calls } = client([{ status: 200, body: { accountId: 'acc-1', displayName: 'Ada', emailAddress: 'ada@example.com' } }]);
		expect(await api.myself()).toEqual({ accountId: 'acc-1', displayName: 'Ada', emailAddress: 'ada@example.com' });
		expect(calls[0].url).toBe('https://gateway.test/ex/jira/cloud-1/rest/api/3/myself');
		expect(calls[0].headers['Authorization']).toBe('Bearer tok');
		expect(calls[0].method).toBe('GET');
	});

	it('pages the projects until Jira says the last page', async () => {
		const { api, calls } = client([
			{ status: 200, body: { values: [{ id: 10000, key: 'APP', name: 'App', style: 'classic' }], isLast: false } },
			{ status: 200, body: { values: [{ id: '10001', key: 'OPS', name: 'Ops' }], isLast: true } }
		]);
		expect(await api.projects()).toEqual([
			{ id: '10000', key: 'APP', name: 'App', projectTypeKey: null, style: 'classic' },
			{ id: '10001', key: 'OPS', name: 'Ops', projectTypeKey: null, style: null }
		]);
		expect(calls[1].url).toContain('/project/search?startAt=1&maxResults=50');
	});

	it('reads a project’s issue types and its statuses, each status once', async () => {
		const { api } = client([
			{ status: 200, body: { id: '10000', key: 'APP', name: 'App', issueTypes: [{ id: '1', name: 'Task', subtask: false }, { id: '2', name: 'Sub-task', subtask: true }] } },
			{
				status: 200,
				body: [
					{ id: '1', name: 'Task', statuses: [{ id: '1', name: 'To Do', statusCategory: { key: 'new' } }, { id: '3', name: 'Done', statusCategory: { key: 'done' } }] },
					{ id: '2', name: 'Sub-task', statuses: [{ id: '3', name: 'Done', statusCategory: { key: 'done' } }] }
				]
			}
		]);
		const project = await api.project('APP');
		expect(project?.issueTypes.map((type) => [type.id, type.subtask])).toEqual([
			['1', false],
			['2', true]
		]);
		expect(project?.statuses.map((status) => `${status.id}:${status.statusCategory.key}`)).toEqual(['1:new', '3:done']);
		const missing = client([{ status: 404, body: { errorMessages: ['No project could be found with key \'X\'.'] } }]);
		expect(await missing.api.project('X')).toBeNull();
	});

	it('searches with the enhanced JQL search: the fields it reads, a page token, never an offset', async () => {
		const { api, calls } = client([
			{ status: 200, body: { issues: [{ id: '1', key: 'A-1', fields: {} }], nextPageToken: 'next-1' } },
			{ status: 200, body: { issues: [], isLast: true, nextPageToken: 'ignored' } }
		]);
		expect(await api.searchIssues('project = 10000', { maxResults: 10 })).toEqual({ issues: [{ id: '1', key: 'A-1', fields: {} }], nextPageToken: 'next-1' });
		expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://gateway.test/ex/jira/cloud-1/rest/api/3/search/jql' });
		expect(calls[0].body).toMatchObject({ jql: 'project = 10000', maxResults: 10 });
		expect((calls[0].body as { fields: string[] }).fields).toEqual(expect.arrayContaining(['summary', 'description', 'status', 'issuelinks', 'comment', 'attachment']));
		expect(await api.searchIssues('project = 10000', { nextPageToken: 'next-1' })).toEqual({ issues: [], nextPageToken: null });
		expect(calls[1].body).toMatchObject({ nextPageToken: 'next-1' });
	});

	it('reads the transitions with their target statuses, and moves an issue by one', async () => {
		const { api, calls } = client([
			{ status: 200, body: { transitions: [{ id: 21, name: 'Start', to: { id: 3, name: 'In Progress', statusCategory: { key: 'indeterminate' } }, hasScreen: false }] } },
			{ status: 204 }
		]);
		expect(await api.transitions('10001')).toEqual([{ id: '21', name: 'Start', to: { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } }, isAvailable: undefined, hasScreen: false }]);
		await api.transitionIssue('10001', '21');
		expect(calls[1]).toMatchObject({ method: 'POST', url: 'https://gateway.test/ex/jira/cloud-1/rest/api/3/issue/10001/transitions', body: { transition: { id: '21' } } });
	});

	it('edits, creates and deletes issues; an empty edit sends nothing', async () => {
		const { api, calls } = client([{ status: 204 }, { status: 201, body: { id: '10050', key: 'APP-50', self: 'x' } }, { status: 204 }]);
		await api.updateIssue('10001', {});
		expect(calls).toHaveLength(0);
		await api.updateIssue('10001', { summary: 'New' });
		expect(calls[0]).toMatchObject({ method: 'PUT', body: { fields: { summary: 'New' } } });
		expect(await api.createIssue({ project: { id: '10000' }, issuetype: { id: '1' }, summary: 'S' })).toEqual({ id: '10050', key: 'APP-50' });
		await api.deleteIssue('10050');
		expect(calls[2]).toMatchObject({ method: 'DELETE', url: expect.stringContaining('/issue/10050') });
	});

	it('answers null for an issue that is gone', async () => {
		const { api } = client([{ status: 404, body: { errorMessages: ['Issue does not exist or you do not have permission to see it.'] } }]);
		expect(await api.issue('10001')).toBeNull();
	});

	it('registers, refreshes and deletes the dynamic webhooks', async () => {
		const { api, calls } = client([
			{ status: 200, body: { webhookRegistrationResult: [{ createdWebhookId: 1001 }, { errors: ['JQL is not supported'] }] } },
			{ status: 200, body: { expirationDate: '2026-12-11T12:00:00.000+0000' } },
			{ status: 202 }
		]);
		expect(await api.registerWebhooks('https://api.example.com/hook/1', [{ events: ['jira:issue_updated'], jqlFilter: 'project in (10000)' }])).toEqual([
			{ createdWebhookId: 1001 },
			{ errors: ['JQL is not supported'] }
		]);
		expect(calls[0].body).toEqual({ url: 'https://api.example.com/hook/1', webhooks: [{ events: ['jira:issue_updated'], jqlFilter: 'project in (10000)' }] });
		expect(await api.refreshWebhooks(['1001'])).toBe('2026-12-11T12:00:00.000Z');
		expect(calls[1]).toMatchObject({ method: 'PUT', url: expect.stringContaining('/webhook/refresh'), body: { webhookIds: [1001] } });
		await api.deleteWebhooks(['1001']);
		expect(calls[2]).toMatchObject({ method: 'DELETE', body: { webhookIds: [1001] } });
	});

	it('reads a refreshed expiry given as epoch milliseconds or as a date, and none from an unreadable one', async () => {
		const { api } = client([
			{ status: 200, body: { expirationDate: Date.UTC(2026, 11, 11, 12) } },
			{ status: 200, body: { expirationDate: 'not a date' } },
			{ status: 200, body: {} }
		]);
		expect(await api.refreshWebhooks(['1001'])).toBe('2026-12-11T12:00:00.000Z');
		expect(await api.refreshWebhooks(['1001'])).toBeNull();
		expect(await api.refreshWebhooks(['1001'])).toBeNull();
	});

	it('surfaces a refused token, a forbidden resource, a rate limit with its wait, and Jira’s own messages', async () => {
		const { api } = client([
			{ status: 401, body: '' },
			{ status: 403, body: { errorMessages: ['You do not have permission'] } },
			{ status: 429, headers: { 'Retry-After': '7' } },
			{ status: 400, body: { errorMessages: [], errors: { summary: 'You must specify a summary of the issue.' } } },
			{ status: 200, body: 'not json' }
		]);
		await expect(api.myself()).rejects.toMatchObject({ status: 401, isUnauthorized: true });
		await expect(api.myself()).rejects.toMatchObject({ status: 403, isForbidden: true, isUnauthorized: false, message: 'You do not have permission' });
		const limited = await api.myself().catch((error: unknown) => error as JiraApiError);
		expect(limited).toMatchObject({ isRateLimited: true, retryAfterSeconds: 7 });
		await expect(api.myself()).rejects.toMatchObject({ status: 400, message: 'summary: You must specify a summary of the issue.' });
		await expect(api.myself()).rejects.toMatchObject({ message: 'Jira answered something that is not JSON' });
	});

	it('reads the wait of a rate limit, and the messages of an error answer', () => {
		const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
		expect(retryAfterSecondsOf(headers({}))).toBeNull();
		expect(retryAfterSecondsOf(headers({ 'Retry-After': '12' }))).toBe(12);
		expect(errorMessageOf({ error: 'invalid_grant', error_description: 'Unknown or invalid refresh token.' }, 'x')).toBe('Unknown or invalid refresh token.');
		expect(errorMessageOf(null, 'fallback')).toBe('fallback');
	});
});

describe('the OAuth endpoints', () => {
	it('exchanges a code and renews a token as JSON posts, the refresh token rotated', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { access_token: 'at', expires_in: 3600, scope: 'read:jira-work offline_access', refresh_token: 'rt' } },
			{ status: 200, body: { access_token: 'at2', expires_in: 3600, refresh_token: 'rt2' } }
		]);
		const token = await exchangeJiraCode('https://auth.test/oauth/token', { code: 'c', clientId: 'id', clientSecret: 's', redirectUri: 'https://api.example.com/cb' }, fetchImpl as never);
		expect(token).toEqual({ accessToken: 'at', tokenType: 'Bearer', expiresIn: 3600, scope: 'read:jira-work offline_access', refreshToken: 'rt' });
		expect(calls[0].body).toEqual({ grant_type: 'authorization_code', client_id: 'id', client_secret: 's', code: 'c', redirect_uri: 'https://api.example.com/cb' });
		expect(calls[0].headers['Content-Type']).toBe('application/json');
		const renewed = await refreshJiraToken('https://auth.test/oauth/token', { refreshToken: 'rt', clientId: 'id', clientSecret: 's' }, fetchImpl as never);
		expect(renewed).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2', scope: null });
		expect(calls[1].body).toEqual({ grant_type: 'refresh_token', client_id: 'id', client_secret: 's', refresh_token: 'rt' });
	});

	it('reads a refused renewal (403 invalid_grant) as a refused token', async () => {
		const { fetchImpl } = fakeFetch([{ status: 403, body: { error: 'invalid_grant', error_description: 'Unknown or invalid refresh token.' } }]);
		await expect(refreshJiraToken('https://auth.test/oauth/token', { refreshToken: 'rt', clientId: 'id', clientSecret: 's' }, fetchImpl as never)).rejects.toMatchObject({
			status: 401,
			isUnauthorized: true
		});
	});

	it('lists the Jira sites the token reaches (and no site of another product)', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{
				status: 200,
				body: [
					{ id: 'cloud-1', url: 'https://one.atlassian.net', name: 'One', scopes: ['read:jira-work', 'write:jira-work'] },
					{ id: 'cloud-2', url: 'https://wiki.atlassian.net', name: 'Wiki', scopes: ['read:confluence-content.all'] },
					{ id: 7 }
				]
			}
		]);
		expect(await accessibleJiraSites('tok', { apiUrl: 'https://gateway.test', fetchImpl: fetchImpl as never })).toEqual([
			{ id: 'cloud-1', url: 'https://one.atlassian.net', name: 'One', scopes: ['read:jira-work', 'write:jira-work'], avatarUrl: null }
		]);
		expect(calls[0].url).toBe('https://gateway.test/oauth/token/accessible-resources');
		const refused = fakeFetch([{ status: 401, body: '' }]);
		await expect(accessibleJiraSites('tok', { fetchImpl: refused.fetchImpl as never })).rejects.toMatchObject({ status: 401 });
	});
});
