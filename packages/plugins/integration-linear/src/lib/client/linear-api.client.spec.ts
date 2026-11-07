import { exchangeLinearCode, LinearApiClient, LinearApiError } from './linear-api.client';

function fakeFetch(answers: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
	const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
	const fetchImpl = async (url: string, init: { headers: Record<string, string>; body: string }) => {
		calls.push({ url, body: init.body.startsWith('{') ? JSON.parse(init.body) : init.body, headers: init.headers });
		const answer = answers.shift() ?? { status: 200, body: { data: {} } };
		return {
			status: answer.status,
			headers: { get: (name: string) => answer.headers?.[name] ?? null },
			text: async () => (typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body))
		};
	};
	return { fetchImpl, calls };
}

describe('LinearApiClient', () => {
	it('sends the token as a bearer and reads the data', async () => {
		const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { data: { viewer: { id: 'u1', name: 'A', email: 'a@x.io', organization: { id: 'o1', name: 'X', urlKey: 'x' } } } } }]);
		const client = new LinearApiClient('tok', { fetchImpl: fetchImpl as never, apiUrl: 'https://api.test/graphql' });
		const viewer = await client.viewer();
		expect(viewer.organization.urlKey).toBe('x');
		expect(calls[0].headers['Authorization']).toBe('Bearer tok');
		expect(calls[0].url).toBe('https://api.test/graphql');
	});

	it('pages the teams and filters the issues by team and watermark', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { data: { teams: { nodes: [{ id: 't1', key: 'A', name: 'A' }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } } } },
			{ status: 200, body: { data: { teams: { nodes: [{ id: 't2', key: 'B', name: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } } } } },
			{ status: 200, body: { data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }
		]);
		const client = new LinearApiClient('tok', { fetchImpl: fetchImpl as never });
		expect((await client.teams()).map((team) => team.key)).toEqual(['A', 'B']);
		expect((calls[1].body as { variables: { after: string } }).variables.after).toBe('c1');
		await client.issues('t1', { updatedAfter: '2026-01-01T00:00:00.000Z', first: 10 });
		expect((calls[2].body as { variables: { filter: unknown; first: number } }).variables).toMatchObject({
			filter: { team: { id: { eq: 't1' } }, updatedAt: { gt: '2026-01-01T00:00:00.000Z' } },
			first: 10
		});
	});

	it('surfaces a refused token, a rate limit and a GraphQL error', async () => {
		const { fetchImpl } = fakeFetch([
			{ status: 401, body: '' },
			{ status: 429, body: '', headers: { 'X-RateLimit-Requests-Reset': String(Date.now() + 30_000) } },
			{ status: 200, body: { errors: [{ message: 'Authentication required', extensions: { code: 'AUTHENTICATION_ERROR' } }] } },
			{ status: 200, body: { errors: [{ message: 'Entity not found' }] } }
		]);
		const client = new LinearApiClient('tok', { fetchImpl: fetchImpl as never });
		await expect(client.viewer()).rejects.toMatchObject({ status: 401, isUnauthorized: true });
		const limited = await client.viewer().catch((error) => error as LinearApiError);
		expect(limited).toBeInstanceOf(LinearApiError);
		expect((limited as LinearApiError).isRateLimited).toBe(true);
		expect((limited as LinearApiError).retryAfterSeconds).toBeGreaterThan(0);
		await expect(client.viewer()).rejects.toMatchObject({ status: 401 });
		await expect(client.viewer()).rejects.toMatchObject({ status: null, message: 'Entity not found' });
	});

	it('exchanges a code as a form post', async () => {
		const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { access_token: 'at', token_type: 'Bearer', expires_in: 3600, scope: 'read,write' } }]);
		const token = await exchangeLinearCode(
			'https://api.test/oauth/token',
			{ code: 'c', clientId: 'id', clientSecret: 's', redirectUri: 'https://api.example.com/cb' },
			fetchImpl as never
		);
		expect(token).toEqual({ accessToken: 'at', tokenType: 'Bearer', expiresIn: 3600, scope: 'read,write' });
		expect(calls[0].body).toContain('grant_type=authorization_code');
		expect(calls[0].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
	});
});
