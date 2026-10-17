import { AsyncLocalStorage } from 'node:async_hooks';
import { LockMode } from '@mikro-orm/core';
import type { EventArgs } from '@mikro-orm/core';
import {
	DataSource,
	EntityManager,
	EntityMetadata,
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	MoreThan,
	QueryRunner,
	RecoverEvent,
	RemoveEvent,
	SoftRemoveEvent,
	UpdateEvent
} from 'typeorm';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';

/**
 * The lease fence (plan 03 §C.4): every Gauzy write a sync pass makes for a connection is checked, in the
 * write's own transaction, against the connection's lease, so a pass that outlived its lease writes
 * nothing once another process holds it.
 *
 * The sync loop holds a database lease per connection (`leaseOwner` / `leaseUntil` on its row) and renews
 * it between items. A single item can still outlast it — a handler waiting on Ever Works, a stalled
 * database — and another process then claims the lease and applies newer events while the first handler
 * is still running. Without a fence, that handler's late writes (a task, a comment, an Inbox copy, …)
 * overwrite the newer ones; the monotonic link versions (#10827) refuse only its link write.
 *
 * {@link withLeaseFence} arms the fence for one unit of work (the applier around each handler, the
 * pusher around each push, the loop around each sweep). While it is armed, the plugin's ORM subscriber
 * ({@link EverWorksLeaseFenceSubscriber}, registered for TypeORM and MikroORM) checks before every insert,
 * update and delete — the platform's services and commands included, since they write through the same
 * ORMs — that this process still holds the lease:
 *
 * - **Inside a transaction** (TypeORM `save()` / `remove()`, any `transaction()`, every MikroORM flush), the
 *   check reads the lease row in that same transaction and locks it for share (`FOR SHARE` on Postgres,
 *   `LOCK IN SHARE MODE` / `FOR SHARE` on MySQL; SQLite's transaction locks the database). A claim is an
 *   update of that row, so it waits until the write commits or rolls back: the lease cannot move between
 *   the check and the write, and once it has moved the check fails. The owner alone decides here.
 * - **Outside a transaction** (a query builder or `update()` / `insert()` / `delete()` statement), the check
 *   and the write are two back-to-back statements on one connection; the check then also needs
 *   {@link LEASE_FENCE_MARGIN_MS} of lease left, so the lease cannot run out and be claimed in between
 *   (only a stall of the process longer than that, between the two statements, could let a claim in; a
 *   write that waits on a row lock instead keeps its place ahead of the new holder's write of that row).
 *
 * A failed check throws {@link EverWorksLeaseLostError} before the write (a transaction rolls back) and
 * marks the unit lost: every later write of it is refused without a query, and {@link withLeaseFence}
 * ends it with that error whatever the handler made of it, so the caller stops (the applier leaves the
 * event to the new holder, the pusher hands its change back). While the unit keeps writing, the lease is
 * renewed in the background every {@link LEASE_FENCE_RENEW_MS} (only while this process still holds it),
 * so a long handler that makes progress keeps it and a stuck one loses it.
 *
 * Writes to the connection row itself (the claim, renewals, the feed cursor) are not fenced: each is
 * already one conditional statement on the lease. Writes that bypass the ORM events (raw SQL, MikroORM's
 * `nativeUpdate` / `nativeDelete`) are covered by {@link assertLeaseFence}, which every sync write calls
 * as it enters its request context (`runInSyncRequestContext`).
 */

/** How long a lease lasts (the loop claims and renews it for this long). */
export const EVER_WORKS_SYNC_LEASE_MS = 5 * 60_000;
/**
 * Lease a check outside a transaction needs left, so the lease cannot be claimed before the write that
 * follows it on the same connection (a claim needs the lease to have run out). While a unit keeps writing,
 * the background renewal keeps about four minutes left, so the margin never refuses a unit that holds it.
 */
export const LEASE_FENCE_MARGIN_MS = 60_000;
/** While a fenced unit keeps writing, its lease is renewed in the background this often. */
export const LEASE_FENCE_RENEW_MS = 60_000;

/** The process no longer holds the connection's lease: nothing more is written for it. */
export class EverWorksLeaseLostError extends Error {
	constructor(reason?: string) {
		super(`The sync lease on this connection moved to another process${reason ? ` (${reason})` : ''}.`);
		this.name = 'EverWorksLeaseLostError';
	}
}

/** The lease a unit of work is fenced on: the connection, the process holding it, and where it is stored. */
export interface EverWorksLease {
	readonly connectionId: string;
	readonly owner: string;
	readonly dataSource: DataSource;
	/** The clock the lease is claimed by (the loop's, which tests pin); `Date.now` otherwise. */
	readonly clock?: () => number;
}

/** The lease of `owner` on a connection; `at` anchors the clock to the time the pass was given. */
export function everWorksLease(dataSource: DataSource, connectionId: string, owner: string, at?: Date): EverWorksLease {
	if (!at) return { dataSource, connectionId, owner };
	const anchor = Date.now();
	return { dataSource, connectionId, owner, clock: () => at.getTime() + (Date.now() - anchor) };
}

interface LeaseFenceState {
	readonly lease: EverWorksLease;
	/** Why the lease was found lost (then every later write is refused); null while it holds. */
	lost: string | null;
	renewedAt: number;
	renewing: Promise<void> | null;
}

const storage = new AsyncLocalStorage<LeaseFenceState>();

const clockOf = (lease: EverWorksLease): number => (lease.clock ?? Date.now)();

/**
 * Runs `fn` with the lease fence armed for `lease` (no lease: `fn` runs unfenced, as an admin action or a
 * test without a lease does). Inside an armed fence for the same lease, `fn` joins it. When any write of
 * `fn` found the lease lost, the result is {@link EverWorksLeaseLostError}, whatever `fn` returned or threw.
 */
export async function withLeaseFence<T>(lease: EverWorksLease | null | undefined, fn: () => Promise<T>): Promise<T> {
	if (!lease) return fn();
	const current = storage.getStore();
	if (current && current.lease.connectionId === lease.connectionId && current.lease.owner === lease.owner) return fn();
	// The pass renewed its lease just before handing out this unit (the loop's `stillOwner`).
	const state: LeaseFenceState = { lease, lost: null, renewedAt: clockOf(lease), renewing: null };
	let result: T;
	try {
		result = await storage.run(state, fn);
	} catch (error) {
		if (state.lost !== null && !(error instanceof EverWorksLeaseLostError)) throw new EverWorksLeaseLostError(state.lost);
		throw error;
	}
	if (state.lost !== null) throw new EverWorksLeaseLostError(state.lost);
	return result;
}

/** Whether a lease fence is armed here (a sync pass's unit of work). */
export function isLeaseFenced(): boolean {
	return !!storage.getStore();
}

/** The background renewal the armed fence has in flight, if any (tests await it). */
export function pendingLeaseRenewal(): Promise<void> | null {
	return storage.getStore()?.renewing ?? null;
}

/**
 * Checks, as for a write outside a transaction (with the margin), that the armed fence's lease still
 * holds; no-op outside a fence. For writes the ORM events do not see, made right after it.
 */
export async function assertLeaseFence(): Promise<void> {
	const state = storage.getStore();
	if (!state) return;
	await verify(state, false, holdsThrough(state.lease.dataSource.manager, state.lease, false));
}

/**
 * Extends the lease while `lease.owner` still holds it (never takes over a lease that ran out or moved);
 * true when extended.
 */
export async function renewLease(lease: EverWorksLease, now: number = clockOf(lease)): Promise<boolean> {
	const result = await lease.dataSource
		.createQueryBuilder()
		.update(EverWorksConnection)
		.set({ leaseUntil: new Date(now + EVER_WORKS_SYNC_LEASE_MS) } as never)
		.where({ id: lease.connectionId, leaseOwner: lease.owner, leaseUntil: MoreThan(new Date(now)) } as never)
		.execute();
	return (result.affected ?? 0) > 0;
}

/**
 * The check itself: `holds(deadline)` reads the lease row (in the write's transaction, with the share
 * lock, when there is one) and says whether `owner` holds it — until `deadline` outside a transaction.
 */
async function verify(state: LeaseFenceState, inTransaction: boolean, holds: (deadline: Date) => Promise<boolean>): Promise<void> {
	if (state.lost !== null) throw new EverWorksLeaseLostError(state.lost);
	const now = clockOf(state.lease);
	const held = await holds(new Date(now + LEASE_FENCE_MARGIN_MS));
	if (!held) {
		state.lost ??= inTransaction ? 'another process holds it' : 'another process holds it, or it runs out';
		throw new EverWorksLeaseLostError(state.lost);
	}
	if (state.lost !== null) throw new EverWorksLeaseLostError(state.lost);
	if (!state.renewing && now - state.renewedAt >= LEASE_FENCE_RENEW_MS) renewInBackground(state, now);
}

/** Renews the lease without waiting for it (and outside the fence: a renewal is no write of the unit). */
function renewInBackground(state: LeaseFenceState, now: number): void {
	state.renewedAt = now;
	state.renewing = storage
		.exit(() => renewLease(state.lease, now))
		.then(
			() => undefined,
			() => undefined
		)
		.finally(() => {
			state.renewing = null;
		});
}

/** Postgres and MySQL lock the lease row for share; SQLite's transaction locks the whole database. */
const ROW_LOCKING_TYPES = new Set(['postgres', 'aurora-postgres', 'cockroachdb', 'mysql', 'mariadb', 'aurora-mysql']);

/** The TypeORM read of the lease row (through `manager`, so in its transaction when it has one). */
function holdsThrough(manager: EntityManager, lease: EverWorksLease, inTransaction: boolean): (deadline: Date) => Promise<boolean> {
	return async (deadline) => {
		const query = manager
			.createQueryBuilder(EverWorksConnection, 'lease')
			.select('lease.id', 'id')
			// In a transaction the share lock makes the owner decisive; outside one the lease must last past the write.
			.where(
				(inTransaction
					? { id: lease.connectionId, leaseOwner: lease.owner }
					: { id: lease.connectionId, leaseOwner: lease.owner, leaseUntil: MoreThan(deadline) }) as never
			);
		if (inTransaction && ROW_LOCKING_TYPES.has(String(manager.connection.options.type))) query.setLock('pessimistic_read');
		return !!(await query.getRawOne());
	};
}

/** Whether a write is one of the lease row itself (claims, renewals and the feed cursor fence themselves). */
function isLeaseRow(metadata: EntityMetadata | undefined): boolean {
	return !!metadata && (metadata.target === EverWorksConnection || metadata.name === EverWorksConnection.name);
}

/** The fence for a TypeORM write: in its transaction when it has one (`save()`, `remove()`, `transaction()`). */
function fenceTypeOrm(event: { queryRunner: QueryRunner; manager: EntityManager; metadata?: EntityMetadata }): Promise<void> | void {
	const state = storage.getStore();
	if (!state || isLeaseRow(event.metadata)) return;
	const inTransaction = !!event.queryRunner?.isTransactionActive;
	return verify(state, inTransaction, holdsThrough(event.manager, state.lease, inTransaction));
}

/**
 * The fence for a MikroORM write. A flush runs its hooks inside its transaction: the lease row is read
 * there (the owner, locked for share). Elsewhere (an upsert) it is checked as outside a transaction,
 * through TypeORM: the lease's clock and dates are TypeORM's (the loop claims with it).
 */
function fenceMikroOrm(args: EventArgs<unknown> | undefined): Promise<void> | void {
	const state = storage.getStore();
	if (!state || !args?.em || args.meta?.className === EverWorksConnection.name) return;
	const em = args.em;
	const ctx = em.getTransactionContext();
	if (!ctx) return verify(state, false, holdsThrough(state.lease.dataSource.manager, state.lease, false));
	const lock = !/sqlite/i.test(em.getPlatform().constructor.name);
	return verify(state, true, async () => {
		const row = await em.getDriver().findOne(
			EverWorksConnection.name,
			{ id: state.lease.connectionId, leaseOwner: state.lease.owner } as never,
			{ ctx, fields: ['id'], ...(lock ? { lockMode: LockMode.PESSIMISTIC_READ } : {}) } as never
		);
		return !!row;
	});
}

const isTypeOrmEvent = (event: object): event is UpdateEvent<unknown> => 'queryRunner' in event;

/**
 * The lease fence on every write (see the top of this file): registered with both ORMs, idle (one
 * `AsyncLocalStorage` read) outside an armed fence, so the rest of the platform is unaffected.
 *
 * TypeORM calls `beforeInsert` / `beforeUpdate` / `beforeRemove` / `beforeSoftRemove` / `beforeRecover`;
 * MikroORM `beforeCreate` / `beforeUpdate` / `beforeDelete` / `beforeUpsert` (`beforeUpdate` serves both,
 * told apart by the event). `@EventSubscriber()` is what lets TypeORM take the class from the plugin's
 * `subscribers` (it keeps only decorated classes).
 */
@EventSubscriber()
export class EverWorksLeaseFenceSubscriber implements EntitySubscriberInterface<unknown> {
	// TypeORM
	beforeInsert(event: InsertEvent<unknown>): Promise<void> | void {
		return fenceTypeOrm(event);
	}

	beforeUpdate(event: UpdateEvent<unknown> | EventArgs<unknown>): Promise<void> | void {
		if (!storage.getStore()) return;
		return isTypeOrmEvent(event) ? fenceTypeOrm(event) : fenceMikroOrm(event as EventArgs<unknown>);
	}

	beforeRemove(event: RemoveEvent<unknown>): Promise<void> | void {
		return fenceTypeOrm(event);
	}

	beforeSoftRemove(event: SoftRemoveEvent<unknown>): Promise<void> | void {
		return fenceTypeOrm(event);
	}

	beforeRecover(event: RecoverEvent<unknown>): Promise<void> | void {
		return fenceTypeOrm(event);
	}

	// MikroORM
	beforeCreate(args: EventArgs<unknown>): Promise<void> | void {
		return fenceMikroOrm(args);
	}

	beforeDelete(args: EventArgs<unknown>): Promise<void> | void {
		return fenceMikroOrm(args);
	}

	beforeUpsert(args: EventArgs<unknown>): Promise<void> | void {
		return fenceMikroOrm(args);
	}
}
