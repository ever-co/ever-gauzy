import { EntityManager } from 'typeorm';
import { IOutboxWriteInput } from '@gauzy/contracts';
import type { EventOutbox, EventOutboxService } from '@gauzy/core';

/**
 * The unique index that refuses a second outbox row at one position of a partition (`CreateEventOutboxTables`):
 * `append` numbers a partition's rows as the highest so far plus one, inside the writing transaction, so two
 * transactions appending to one partition at once compute the same position and the second insert is refused.
 */
export const OUTBOX_PARTITION_SEQUENCE_INDEX = 'UQ_event_outbox_partition_seq';

/** How many times an append that lost a partition race is tried in all. */
export const OUTBOX_APPEND_ATTEMPTS = 5;

/**
 * Whether an error is the outbox refusing a second row at one position of a partition — Postgres (`23505` on the
 * index), MySQL (`ER_DUP_ENTRY` on the index) or SQLite (the index's two columns) — rather than any other failure.
 */
export function isPartitionSequenceConflict(error: unknown): boolean {
	const failure = error as { code?: unknown; errno?: unknown; constraint?: unknown; message?: unknown; driverError?: unknown } | null;
	const driver = (failure?.driverError ?? failure) as { code?: unknown; errno?: unknown; constraint?: unknown; message?: unknown } | null;
	const message = `${String(driver?.message ?? '')} ${String(failure?.message ?? '')}`;
	if (driver?.code === '23505') {
		return driver.constraint === OUTBOX_PARTITION_SEQUENCE_INDEX || message.includes(OUTBOX_PARTITION_SEQUENCE_INDEX);
	}
	if (driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062) {
		return message.includes(OUTBOX_PARTITION_SEQUENCE_INDEX);
	}
	return message.includes('UNIQUE constraint failed: event_outbox.partitionKey, event_outbox.sequence');
}

/**
 * Appends an outbox row inside the caller's open transaction, so the row commits — or rolls back — with the write it
 * describes.
 *
 * The append runs in a savepoint and is tried again when it lost a partition race
 * ({@link isPartitionSequenceConflict}): the other transaction's row is committed by the time the refused insert
 * returns, so the next attempt numbers past it — provided the transaction reads committed data, which the chat writes
 * ensure on MySQL (`inWriteTransaction`; Postgres reads that way by default). Without the savepoint the refused insert
 * would abort the caller's transaction (Postgres) and fail the write itself — a chat message would not be sent because
 * another member read the conversation at the same moment. Any other failure fails the write: an event that cannot be stored is not silently
 * dropped.
 *
 * @param outbox The platform outbox.
 * @param manager The manager of the caller's open transaction.
 * @param input The event.
 * @returns The stored row.
 * @throws Error when the manager has no open transaction (the row would commit on its own).
 */
export async function appendInTransaction(outbox: EventOutboxService, manager: EntityManager, input: IOutboxWriteInput): Promise<EventOutbox> {
	if (!manager.queryRunner?.isTransactionActive) {
		throw new Error('An in-transaction append needs the manager of an open transaction.');
	}
	for (let attempt = 1; ; attempt += 1) {
		try {
			// A nested transaction is a savepoint: a refused insert undoes this append only.
			return await manager.transaction((savepoint) => outbox.append(savepoint, input));
		} catch (error) {
			if (attempt >= OUTBOX_APPEND_ATTEMPTS || !isPartitionSequenceConflict(error)) throw error;
		}
	}
}
