import { AsyncLocalStorage } from 'node:async_hooks';

/** What the inbound applier is doing right now. */
export interface EverWorksSyncContextState {
	connectionId: string;
	integrationTenantId?: string | null;
	eventId?: string | null;
	/**
	 * The Gauzy Inbox recipient row an apply acts for (an Ever Works member's move on their copy of a Gauzy item): the
	 * item change that move writes is not sent back to that copy, but still goes to the copies of the other recipients.
	 */
	gauzyRecipientId?: string | null;
}

const storage = new AsyncLocalStorage<EverWorksSyncContextState>();

/**
 * Loop guard level 1 (plan 03 §C.2): the inbound applier runs every Gauzy write inside
 * {@link EverWorksSyncContext.run}; every outbound trigger (the `TaskEvent` listener, the entity
 * subscribers) checks {@link EverWorksSyncContext.isApplying} first and skips what the sync itself wrote.
 * The context follows the asynchronous work it was started for and nothing else.
 */
export class EverWorksSyncContext {
	static run<T>(state: EverWorksSyncContextState, work: () => T): T {
		return storage.run({ ...state }, work);
	}

	/** True inside an inbound apply (for this connection, when one is named). */
	static isApplying(connectionId?: string): boolean {
		const state = storage.getStore();
		return !!state && (!connectionId || state.connectionId === connectionId);
	}

	static current(): EverWorksSyncContextState | undefined {
		return storage.getStore();
	}
}
