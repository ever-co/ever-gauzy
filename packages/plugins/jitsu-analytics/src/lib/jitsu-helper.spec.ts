jest.mock('@gauzy/config', () => ({
	environment: { jitsu: { serverHost: '', serverWriteKey: '' } }
}));
jest.mock('node-fetch', () => jest.fn());
jest.mock('@jitsu/js', () => ({ jitsuAnalytics: jest.fn() }));

import { jitsuClientRecycleEvents, recyclingJitsu, DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS } from './jitsu-helper';

/**
 * A stand-in for a Jitsu client: it remembers every event like the analytics core's `history` does.
 */
function fakeClient(id: number) {
	let anonymousId = `anon-${id}`;
	const history: unknown[] = [];
	return {
		id,
		history,
		track: jest.fn(async (event: string) => {
			history.push(event);
			return { event, client: id };
		}),
		page: jest.fn(async () => undefined),
		identify: jest.fn(async () => undefined),
		group: jest.fn(async () => undefined),
		user: () => ({ anonymousId }),
		setAnonymousId: (value: string) => {
			anonymousId = value;
		},
		configure: jest.fn()
	};
}

describe('recyclingJitsu', () => {
	it('replaces the client after the configured number of events, so no client accumulates more', async () => {
		const created: ReturnType<typeof fakeClient>[] = [];
		const client = recyclingJitsu(() => {
			const c = fakeClient(created.length);
			created.push(c);
			return c as any;
		}, 3);

		for (let i = 0; i < 10; i++) {
			await client.track(`e${i}`);
		}

		// 10 events, 3 per client: 4 clients used, the longest history is 3.
		expect(created.map((c) => c.history.length)).toEqual([3, 3, 3, 1, 0].slice(0, created.length));
		expect(Math.max(...created.map((c) => c.history.length))).toBeLessThanOrEqual(3);
		// Every event was sent exactly once.
		expect(created.flatMap((c) => c.history)).toEqual(Array.from({ length: 10 }, (_, i) => `e${i}`));
	});

	it('carries the anonymous id over to the next client', async () => {
		const created: ReturnType<typeof fakeClient>[] = [];
		const client = recyclingJitsu(() => {
			const c = fakeClient(created.length);
			created.push(c);
			return c as any;
		}, 1);
		await client.track('a');
		await client.track('b');
		expect(created[1].user().anonymousId).toBe('anon-0');
	});

	it('returns the client itself when recycling is disabled or no client could be built', () => {
		const single = fakeClient(0);
		expect(recyclingJitsu(() => single as any, 0)).toBe(single);
		expect(recyclingJitsu(() => undefined as any, 5)).toBeUndefined();
	});

	it('reads JITSU_CLIENT_RECYCLE_EVENTS', () => {
		expect(jitsuClientRecycleEvents({})).toBe(DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS);
		expect(jitsuClientRecycleEvents({ JITSU_CLIENT_RECYCLE_EVENTS: '0' })).toBe(0);
		expect(jitsuClientRecycleEvents({ JITSU_CLIENT_RECYCLE_EVENTS: '42' })).toBe(42);
		expect(jitsuClientRecycleEvents({ JITSU_CLIENT_RECYCLE_EVENTS: 'x' })).toBe(DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS);
		expect(jitsuClientRecycleEvents({ JITSU_CLIENT_RECYCLE_EVENTS: '10abc' })).toBe(DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS);
		expect(jitsuClientRecycleEvents({ JITSU_CLIENT_RECYCLE_EVENTS: '1e3' })).toBe(DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS);
	});
});
