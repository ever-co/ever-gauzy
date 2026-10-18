import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Runs capture work outside the asynchronous context it was signalled from.
 *
 * The plugin's entity subscribers and its `TaskEvent` listener fire inside the write that changed the record — on
 * SQLite, inside the transaction that holds the embedded database's one connection (`@gauzy/core`
 * `embedded-transaction-queue.ts`, whose connection ownership follows an `AsyncLocalStorage`). Work started there
 * and left running (the capture never makes the write wait) kept that transaction's ownership after it committed:
 * when it then opened the outbound queue's own transaction, the queue took it for a nested one, its `BEGIN` ran
 * owned by nobody, its commit was refused (`TransactionNotStartedError`) and the connection stayed inside a
 * transaction nothing would ever end — every later request waited 60 s and failed, the API's health check too.
 * Found by the first local Gauzy ↔ Ever Works end-to-end run: one Gauzy comment on a synced task wedged the API.
 *
 * Run from here, the work has no ownership of its own: its transaction queues for the connection like any other and
 * starts once the write that signalled it has committed. Read what the work needs from the original context (the
 * acting user, the sync's own loop guard) before handing it over.
 *
 * The snapshot is taken when this module loads, outside every request and transaction.
 */
const outsideEveryContext = AsyncLocalStorage.snapshot();

/** Calls `work` outside every request and transaction context (see above) and returns what it returns. */
export function runDetached<T>(work: () => T): T {
	return outsideEveryContext(work);
}
