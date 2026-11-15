/**
 * The pooled connections a process sets aside to hold a database lock (an advisory lock on PostgreSQL, a named lock
 * on MySQL) while the locked work runs on other connections of the same pool.
 *
 * Such a lock holds its connection until the work it guards settles, and that work needs a connection of its own.
 * Without a bound, enough simultaneous lock holders could take every connection of the pool while each waits for one
 * more, and none could finish. Every workflow that holds a lock this way takes one of a few slots shared by the whole
 * process, whatever the workflow, so the locked work always finds the rest of the pool; the others wait for a slot,
 * holding no connection meanwhile.
 */

/** The lock holders of this process holding a connection, and those waiting for a slot. */
let lockConnectionsInUse = 0;
const lockConnectionWaiters: Array<() => void> = [];

/**
 * How many connections of the pool this process may set aside for such locks at once: half the pool, at most 4. A
 * pool of a single connection cannot spare one (0): a workflow then keeps its in-process guard alone.
 *
 * @param options - The data source options (`poolSize`, or the pg-pool `extra.max`).
 */
export function lockConnectionSlots(options?: { poolSize?: number; extra?: { max?: number } }): number {
	const stated = Number(options?.poolSize ?? options?.extra?.max ?? 0);
	// 0 (or nothing) is the drivers' default rather than "no connection": pg-pool then opens up to 10, mysql2 any
	// number (`DB_POOL_SIZE=0` is accepted for both). 10 is the smaller of the two.
	const poolSize = Number.isFinite(stated) && stated > 0 ? stated : 10;
	return Math.min(4, Math.floor(poolSize / 2));
}

/** Waits until fewer than `slots` lock holders of this process hold a connection, then takes a slot. */
export async function takeLockConnectionSlot(slots: number): Promise<void> {
	while (lockConnectionsInUse >= slots) {
		await new Promise<void>((resolve) => lockConnectionWaiters.push(resolve));
	}
	lockConnectionsInUse++;
}

/** Gives a slot back and wakes the next lock holder waiting for one. */
export function releaseLockConnectionSlot(): void {
	lockConnectionsInUse--;
	lockConnectionWaiters.shift()?.();
}
