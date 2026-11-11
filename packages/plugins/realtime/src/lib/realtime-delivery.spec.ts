import { describeRealtimeDelivery, isSingleApiProcess } from './realtime-delivery';

/**
 * What the status route tells a client about delivery decides whether the client stops polling. Saying
 * "prompt" where an event can reach the socket a minute late (or never) leaves a chat that looks frozen.
 */
describe('describeRealtimeDelivery', () => {
	it('is prompt when the pub/sub reaches every process, however the pass is asked for', () => {
		expect(describeRealtimeDelivery('queue', true, false)).toEqual({
			dispatch: 'queue',
			shared: true,
			singleProcess: false,
			prompt: true
		});
		expect(describeRealtimeDelivery('inline', true, false).prompt).toBe(true);
	});

	it('is prompt without a shared pub/sub only where one API process holds every socket', () => {
		expect(describeRealtimeDelivery('inline', false, true).prompt).toBe(true);
		expect(describeRealtimeDelivery('queue', false, true).prompt).toBe(true);
		// Several replicas on one database: a pass run by one of them reaches its own sockets only.
		expect(describeRealtimeDelivery('inline', false, false).prompt).toBe(false);
		expect(describeRealtimeDelivery('queue', false, false).prompt).toBe(false);
	});

	it('is never prompt when only a schedule dispatches', () => {
		expect(describeRealtimeDelivery('none', true, true).prompt).toBe(false);
		expect(describeRealtimeDelivery('none', false, false).prompt).toBe(false);
	});
});

describe('isSingleApiProcess', () => {
	it('holds on SQLite, whose database belongs to one process', () => {
		expect(isSingleApiProcess('better-sqlite3', undefined)).toBe(true);
		expect(isSingleApiProcess('sqlite', undefined)).toBe(true);
		// Empty, or unset: the platform runs on better-sqlite3.
		expect(isSingleApiProcess('', undefined)).toBe(true);
		const previous = process.env['DB_TYPE'];
		try {
			delete process.env['DB_TYPE'];
			expect(isSingleApiProcess(undefined, undefined)).toBe(true);
		} finally {
			if (previous === undefined) delete process.env['DB_TYPE'];
			else process.env['DB_TYPE'] = previous;
		}
	});

	it('holds elsewhere only when the deployment says so', () => {
		expect(isSingleApiProcess('postgres', undefined)).toBe(false);
		expect(isSingleApiProcess('postgres', 'false')).toBe(false);
		expect(isSingleApiProcess('postgres', 'true')).toBe(true);
	});
});
