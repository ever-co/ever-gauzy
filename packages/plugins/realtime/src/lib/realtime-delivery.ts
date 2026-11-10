import { IRealtimeDelivery } from '@gauzy/contracts';

/**
 * How promptly a written fact reaches an open subscription, from how this process dispatches the outbox
 * and whether its pub/sub reaches every API process.
 *
 * Prompt when the event is dispatched right after it is written and reaches the socket whichever process
 * dispatches it: in this process with no queue (one API process, or a shared pub/sub), or through the
 * queue with a shared pub/sub. Through the queue without one, the pass may run in a process that does
 * not hold the socket, so a client must keep polling.
 *
 * @param dispatch How appended events are dispatched in this process.
 * @param shared Whether a publish reaches the sockets of every API process.
 * @returns What the status route reports.
 */
export function describeRealtimeDelivery(dispatch: IRealtimeDelivery['dispatch'], shared: boolean): IRealtimeDelivery {
	return {
		dispatch,
		shared,
		prompt: dispatch === 'inline' || (dispatch === 'queue' && shared)
	};
}
