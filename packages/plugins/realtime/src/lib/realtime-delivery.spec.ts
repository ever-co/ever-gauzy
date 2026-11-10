import { describeRealtimeDelivery } from './realtime-delivery';

/**
 * What the status route tells a client about delivery decides whether the client stops polling. Saying
 * "prompt" where an event can reach the socket a minute late (or never) leaves a chat that looks frozen.
 */
describe('describeRealtimeDelivery', () => {
	it('is prompt when this process dispatches right after the append', () => {
		expect(describeRealtimeDelivery('inline', false)).toEqual({ dispatch: 'inline', shared: false, prompt: true });
		expect(describeRealtimeDelivery('inline', true).prompt).toBe(true);
	});

	it('is prompt through the queue only when the pub/sub reaches every process', () => {
		expect(describeRealtimeDelivery('queue', true)).toEqual({ dispatch: 'queue', shared: true, prompt: true });
		// The pass may run in a process that does not hold the socket.
		expect(describeRealtimeDelivery('queue', false).prompt).toBe(false);
	});

	it('is never prompt when only a schedule dispatches', () => {
		expect(describeRealtimeDelivery('none', true).prompt).toBe(false);
		expect(describeRealtimeDelivery('none', false).prompt).toBe(false);
	});
});
