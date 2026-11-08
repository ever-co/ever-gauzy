// cspell:ignore Fapi — the URL-encoded `/api` of a callback URL
import { TrelloApiClient, TrelloApiError } from './trello-api.client';

function fakeFetch(answers: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
	const calls: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }> = [];
	const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
		calls.push({ url, method: init.method, body: init.body?.startsWith('{') ? JSON.parse(init.body) : init.body, headers: init.headers });
		const answer = answers.shift() ?? { status: 200, body: {} };
		return {
			status: answer.status,
			headers: { get: (name: string) => answer.headers?.[name] ?? null },
			text: async () => (typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body))
		};
	};
	return { fetchImpl, calls };
}

const client = (fetchImpl: unknown) => new TrelloApiClient('k1', 'tok', { fetchImpl: fetchImpl as never, apiUrl: 'https://api.test/1' });

describe('TrelloApiClient', () => {
	it('sends the key and the token as query parameters and reads the member', async () => {
		const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { id: 'm1', username: 'ada', fullName: 'Ada L', email: 'ada@x.io' } }]);
		const me = await client(fetchImpl).me();
		expect(me).toEqual({ id: 'm1', username: 'ada', fullName: 'Ada L', email: 'ada@x.io' });
		expect(calls[0].url).toBe('https://api.test/1/members/me?fields=id%2Cusername%2CfullName%2Cemail&key=k1&token=tok');
		expect(calls[0].headers['Authorization']).toBeUndefined();
	});

	it('lists the open boards and the lists of one in their order', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: [{ id: 'b1', name: 'Roadmap', closed: false }] },
			{ status: 200, body: [{ id: 'l2', name: 'Doing', closed: false, pos: 2 }, { id: 'l1', name: 'To do', closed: false, pos: 1 }] }
		]);
		const api = client(fetchImpl);
		expect((await api.boards())[0]).toEqual({ id: 'b1', name: 'Roadmap', closed: false, idOrganization: null, url: null });
		expect(calls[0].url).toContain('/members/me/boards?filter=open');
		expect((await api.lists('b1')).map((list) => list.id)).toEqual(['l1', 'l2']);
		expect(calls[1].url).toContain('/boards/b1/lists?filter=open');
	});

	it('pages the cards of a board backwards by id, with their members and labels', async () => {
		const page = (ids: string[]) => ids.map((id) => ({ id, name: id, idBoard: 'b1', idList: 'l1', dateLastActivity: '2026-01-01T00:00:00.000Z', members: [{ id: 'm1', username: 'ada', fullName: 'Ada' }], labels: [{ id: 'lb1', name: 'Bug', color: 'red' }] }));
		const { fetchImpl, calls } = fakeFetch([{ status: 200, body: page(['c3', 'c2']) }, { status: 200, body: page(['c1']) }]);
		const api = client(fetchImpl);
		const first = await api.cards('b1', { limit: 2 });
		expect(first.items.map((card) => card.id)).toEqual(['c3', 'c2']);
		expect(first.items[0]).toMatchObject({ closed: false, dueComplete: false, due: null, desc: null, members: [{ id: 'm1', username: 'ada', fullName: 'Ada' }], labels: [{ id: 'lb1', name: 'Bug', color: 'red' }] });
		expect(first.nextBefore).toBe('c2');
		expect(calls[0].url).toContain('filter=all');
		expect(calls[0].url).toContain('members=true');
		const second = await api.cards('b1', { limit: 2, before: first.nextBefore });
		expect(second.items.map((card) => card.id)).toEqual(['c1']);
		expect(second.nextBefore).toBeNull();
		expect(calls[1].url).toContain('before=c2');
	});

	it('updates and creates cards through query parameters, and reads a missing card as null', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { id: 'c1', name: 'New', idBoard: 'b1', idList: 'l2', dateLastActivity: 'x' } },
			{ status: 200, body: { id: 'c9', name: 'Made', idBoard: 'b1', idList: 'l1', dateLastActivity: 'x' } },
			{ status: 404, body: 'The requested resource was not found.' }
		]);
		const api = client(fetchImpl);
		await api.updateCard('c1', { name: 'New', idList: 'l2', due: null, dueComplete: true });
		expect(calls[0].method).toBe('PUT');
		expect(calls[0].url).toContain('/cards/c1?name=New&idList=l2&due=&dueComplete=true');
		await api.createCard({ idList: 'l1', name: 'Made', desc: 'd', due: '2026-02-01T00:00:00.000Z' });
		expect(calls[1].method).toBe('POST');
		expect(calls[1].url).toContain('/cards?idList=l1&name=Made');
		expect(calls[1].url).toContain('due=2026-02-01T00%3A00%3A00.000Z');
		expect(await api.card('gone')).toBeNull();
	});

	it('surfaces a refused token, a rate limit with its wait, and a plain-text error', async () => {
		const { fetchImpl } = fakeFetch([
			{ status: 401, body: 'invalid token' },
			{ status: 429, body: '', headers: { 'Retry-After': '7' } },
			{ status: 400, body: { message: 'invalid id' } }
		]);
		const api = client(fetchImpl);
		await expect(api.me()).rejects.toMatchObject({ name: 'TrelloApiError', status: 401, isUnauthorized: true, message: 'invalid token' });
		await expect(api.me()).rejects.toMatchObject({ status: 429, isRateLimited: true, retryAfterSeconds: 7 });
		await expect(api.me()).rejects.toThrow(TrelloApiError);
	});

	it('registers and removes a webhook, a missing one silently', async () => {
		const { fetchImpl, calls } = fakeFetch([
			{ status: 200, body: { id: 'w1', active: true, idModel: 'b1', callbackURL: 'https://api.example.com/api/integration/trello/webhook/m-1' } },
			{ status: 404, body: 'not found' }
		]);
		const api = client(fetchImpl);
		const webhook = await api.createWebhook({ idModel: 'b1', callbackURL: 'https://api.example.com/api/integration/trello/webhook/m-1', description: 'mapping m-1' });
		expect(webhook.id).toBe('w1');
		expect(calls[0].url).toContain('/webhooks?idModel=b1&callbackURL=https%3A%2F%2Fapi.example.com');
		await expect(api.deleteWebhook('w1')).resolves.toBeUndefined();
	});
});
