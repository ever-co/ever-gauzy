import { AsanaApiClient, AsanaApiError, exchangeAsanaCode, refreshAsanaToken } from './asana-api.client';

function fakeFetch(answers: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
	const calls: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }> = [];
	const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
		calls.push({ url, method: init.method, body: init.body?.startsWith('{') ? JSON.parse(init.body) : init.body, headers: init.headers });
		const answer = answers.shift() ?? { status: 200, body: { data: {} } };
		return {
			status: answer.status,
			headers: { get: (name: string) => answer.headers?.[name] ?? null },
			text: async () => (typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body))
		};
	};
	return { fetchImpl, calls };
}

describe('AsanaApiClient', () => {
	it('sends the token as a bearer and reads `data`', async () => {
		const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { data: { gid: 'u1', name: 'A', email: 'a@x.io', workspaces: [{ gid: 'w1', name: 'Acme' }] } } }]);
		const client = new AsanaApiClient('tok', { fetchImpl: fetchImpl as never, apiUrl: 'https://api.test/1.0' });
		const me = await client.me();
		expect(me.workspaces[0].gid).toBe('w1');
		expect(calls[0].headers['Authorization']).toBe('Bearer tok');
		expect(calls[0].url).toBe('https://api.test/1.0/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name');
	});

	it('pages a list with the offset and filters the tasks of a project since a watermark', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { data: [{ gid: 'p1', name: 'A', archived: false }], next_page: { offset: 'o1' } } },
			{ status: 200, body: { data: [{ gid: 'p2', name: 'B', archived: true }], next_page: null } },
			{ status: 200, body: { data: [], next_page: null } }
		]);
		const client = new AsanaApiClient('tok', { fetchImpl: fetchImpl as never });
		expect((await client.projects('w1')).map((project) => project.gid)).toEqual(['p1', 'p2']);
		expect(calls[1].url).toContain('offset=o1');
		const page = await client.tasks('p1', { modifiedSince: '2026-01-01T00:00:00.000Z', limit: 10 });
		expect(page).toEqual({ items: [], nextOffset: null });
		expect(calls[2].url).toContain('project=p1');
		expect(calls[2].url).toContain('modified_since=2026-01-01T00%3A00%3A00.000Z');
		expect(calls[2].url).toContain('limit=10');
	});

	it('wraps a body in `data`, and surfaces a refused token, a rate limit and an error message', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { data: { gid: 't1', name: 'T' } } },
			{ status: 401, body: { errors: [{ message: 'Not Authorized' }] } },
			{ status: 429, body: '', headers: { 'Retry-After': '12' } },
			{ status: 404, body: { errors: [{ message: 'task: Unknown object' }] } }
		]);
		const client = new AsanaApiClient('tok', { fetchImpl: fetchImpl as never });
		await client.updateTask('t1', { name: 'T', completed: true });
		expect(calls[0].method).toBe('PUT');
		expect(calls[0].body).toEqual({ data: { name: 'T', completed: true } });
		await expect(client.me()).rejects.toMatchObject({ status: 401, isUnauthorized: true, message: 'Not Authorized' });
		const limited = await client.me().catch((error) => error as AsanaApiError);
		expect((limited as AsanaApiError).isRateLimited).toBe(true);
		expect((limited as AsanaApiError).retryAfterSeconds).toBe(12);
		expect(await client.task('gone')).toBeNull();
	});

	it('exchanges a code and renews a token as form posts, reading the user of the exchange', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { access_token: 'at', token_type: 'bearer', expires_in: 3600, refresh_token: 'rt', data: { gid: 'u1', name: 'Ann', email: 'ann@x.io' } } },
			{ status: 200, body: { access_token: 'at2', token_type: 'bearer', expires_in: 3600 } }
		]);
		const token = await exchangeAsanaCode('https://asana.test/oauth_token', { code: 'c', clientId: 'id', clientSecret: 's', redirectUri: 'https://api.example.com/cb' }, fetchImpl as never);
		expect(token).toEqual({ accessToken: 'at', tokenType: 'bearer', expiresIn: 3600, refreshToken: 'rt', user: { gid: 'u1', name: 'Ann', email: 'ann@x.io' } });
		expect(calls[0].body).toContain('grant_type=authorization_code');
		const renewed = await refreshAsanaToken('https://asana.test/oauth_token', { refreshToken: 'rt', clientId: 'id', clientSecret: 's' }, fetchImpl as never);
		expect(renewed).toMatchObject({ accessToken: 'at2', refreshToken: null, user: null });
		expect(calls[1].body).toContain('grant_type=refresh_token');
	});
});
