import { Logger } from '@nestjs/common';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';

/**
 * Tells the dispatcher that an appended event has been committed, so it can be handed to its
 * consumers at once instead of on the next scheduled pass (realtime-channel plan §15.9, T28).
 *
 * `append` writes inside the caller's transaction and performs no I/O, which is what makes the outbox
 * transactional: a rollback removes the event with the state change it describes. The flip side is
 * that nothing knows *when* the event becomes visible, so before this signal a live subscriber waited
 * for the per-minute dispatch pass. A pass started before the commit cannot see the row, so the signal
 * fires after the commit of the transaction the event was appended in, never at the append itself:
 *
 * - **TypeORM:** the data source's `afterTransactionCommit` hook, for the query runner the append used,
 *   once that runner has no transaction left. TypeORM also raises the hook when a savepoint is
 *   released, and the event is not visible yet at that point.
 * - **MikroORM:** the event manager's `afterTransactionCommit` hook, which MikroORM raises for root
 *   transactions only, matched to the root of the transaction context the append used.
 * - **No transaction:** the insert has committed by the time `append` returns, so the signal fires then.
 *
 * A rollback raises nothing. The appended event is gone, and there is nothing to dispatch.
 *
 * The signal only tells listeners that something new may be due. It carries no event, and a listener
 * that is told twice runs one pass too many, which claims nothing. It owns no state a listener depends
 * on, and the scheduled pass still runs, so a missed or failed signal costs latency, never an event.
 */
export class EventOutboxCommitSignal {
	private readonly logger = new Logger(EventOutboxCommitSignal.name);

	private readonly listeners = new Set<() => void>();

	/** TypeORM query runners whose open transaction holds an appended event. */
	private readonly awaitingTypeOrm = new WeakSet<QueryRunner>();

	/** MikroORM root transaction contexts that hold an appended event. */
	private readonly awaitingMikroOrm = new WeakSet<object>();

	/** The TypeORM data sources and MikroORM event managers this signal already listens to. */
	private readonly watched = new WeakSet<object>();

	/**
	 * Adds a listener.
	 *
	 * @param listener Called after each commit that holds an appended event, synchronously from the
	 * ORM's hook, so it should only schedule work.
	 * @returns A function that removes the listener.
	 */
	listen(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Records an append made through a TypeORM manager.
	 *
	 * @param manager The manager the event was saved through.
	 */
	appendedWithTypeOrm(manager: EntityManager): void {
		const runner = manager.queryRunner;

		if (!runner || runner.isReleased || !runner.isTransactionActive) {
			// `save` opened and committed a transaction of its own.
			this.committed();

			return;
		}

		this.watchTypeOrm(manager.connection);
		this.awaitingTypeOrm.add(runner);
	}

	/**
	 * Records an append made through a MikroORM manager.
	 *
	 * @param em The manager the event was inserted through, already resolved to its context.
	 */
	appendedWithMikroOrm(em: { getTransactionContext(): unknown; getEventManager(): unknown }): void {
		const context = em.getTransactionContext();

		if (!isReference(context)) {
			this.committed();

			return;
		}

		// A transaction forked inside another may clone its event manager, so the hook is added to the
		// manager of this context as well as to the root manager the service watched when it was built.
		this.watchMikroOrm(em.getEventManager());
		this.awaitingMikroOrm.add(rootTransactionOf(context));
	}

	/**
	 * Listens to the transaction hooks of a TypeORM data source.
	 *
	 * @param dataSource The data source.
	 */
	watchTypeOrm(dataSource: DataSource | undefined): void {
		if (!dataSource || this.watched.has(dataSource) || !Array.isArray(dataSource.subscribers)) {
			return;
		}

		this.watched.add(dataSource);
		dataSource.subscribers.push({
			afterTransactionCommit: ({ queryRunner }) => {
				// Released savepoints raise the hook too; the outer transaction is still open then.
				if (queryRunner.isTransactionActive || !this.awaitingTypeOrm.has(queryRunner)) {
					return;
				}

				this.awaitingTypeOrm.delete(queryRunner);
				this.committed();
			},
			afterTransactionRollback: ({ queryRunner }) => {
				if (!queryRunner.isTransactionActive) {
					this.awaitingTypeOrm.delete(queryRunner);
				}
			}
		});
	}

	/**
	 * Listens to the transaction hooks of a MikroORM event manager.
	 *
	 * Called with the root manager when the service is built, because `em.transactional` copies the
	 * manager's subscribers into the transaction's fork when it starts.
	 *
	 * @param eventManager The event manager.
	 */
	watchMikroOrm(eventManager: unknown): void {
		const manager = eventManager as { registerSubscriber?: (subscriber: object) => void } | undefined;

		if (!manager || typeof manager.registerSubscriber !== 'function' || this.watched.has(manager)) {
			return;
		}

		this.watched.add(manager);
		manager.registerSubscriber({
			afterTransactionCommit: (args: { transaction?: unknown }) => {
				const context = args?.transaction;

				if (!isReference(context) || !this.awaitingMikroOrm.has(context)) {
					return;
				}

				this.awaitingMikroOrm.delete(context);
				this.committed();
			},
			afterTransactionRollback: (args: { transaction?: unknown }) => {
				if (isReference(args?.transaction)) {
					this.awaitingMikroOrm.delete(args.transaction);
				}
			}
		});
	}

	/** Tells every listener that an appended event is committed. */
	committed(): void {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (error) {
				// A listener's failure must not reach the ORM hook, which would fail the caller's commit.
				this.logger.warn(`A listener of committed outbox appends failed: ${String((error as Error)?.message ?? error)}`);
			}
		}
	}
}

/**
 * Whether a value can key a weak set. A Knex transaction context is a function (it is also a query
 * builder you call with a table name), so an object check alone would treat every context as none.
 *
 * @param value The value.
 * @returns Whether it is an object or a function.
 */
function isReference(value: unknown): value is object {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * The root of a MikroORM (Knex) transaction context.
 *
 * A nested `transactional` runs in a savepoint whose context points at its parent through a symbol
 * MikroORM does not export, and MikroORM raises its commit hooks for the root only. The symbol is found
 * by its description. A context without one is the root.
 *
 * @param context A transaction context.
 * @returns The root context.
 */
export function rootTransactionOf(context: object): object {
	let current: object = context;

	for (let depth = 0; depth < 32; depth += 1) {
		const parentKey = Object.getOwnPropertySymbols(current).find(
			(symbol) => symbol.description === 'parentTransaction'
		);
		const parent = parentKey ? (current as Record<symbol, unknown>)[parentKey] : undefined;

		if (!isReference(parent)) {
			return current;
		}

		current = parent;
	}

	return current;
}
