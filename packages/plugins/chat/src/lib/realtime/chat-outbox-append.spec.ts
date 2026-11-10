/**
 * A chat fact is appended inside the write's own transaction (`appendInTransaction`): it commits with the write or not
 * at all, and a lost partition race is tried again in a savepoint instead of failing the write.
 *
 * The transactions run for real on an in-memory better-sqlite3 store, with the outbox's own unique index over
 * (`partitionKey`, `sequence`). The outbox is a stand-in that numbers a partition the way `EventOutboxService.append`
 * does (the highest position so far plus one, read inside the caller's transaction); `@gauzy/core` is doubled at the
 * module boundary (its barrel boots the whole application), as in the other chat specs.
 */
jest.mock('@gauzy/core', () => ({ __esModule: true }));

import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { IOutboxWriteInput } from '@gauzy/contracts';
import type { EventOutbox, EventOutboxService } from '@gauzy/core';
import { appendInTransaction, isPartitionSequenceConflict, OUTBOX_APPEND_ATTEMPTS, OUTBOX_PARTITION_SEQUENCE_INDEX } from './chat-outbox-append';

/** An outbox that writes as the platform's does; `stale` makes the next appends read the position another took. */
function outboxOver() {
	const state = { stale: 0, appends: 0 };
	const outbox = {
		append: jest.fn(async (manager: EntityManager, input: IOutboxWriteInput) => {
			state.appends += 1;
			const partitionKey = `${input.aggregateType}:${input.aggregateId}`;
			const [{ max }] = await manager.query(`SELECT MAX("sequence") AS "max" FROM "event_outbox" WHERE "partitionKey" = ?`, [partitionKey]);
			let sequence = Number(max ?? 0) + 1;
			if (state.stale > 0) {
				// A competitor read the same highest position and committed first: this insert is refused.
				state.stale -= 1;
				sequence = Number(max ?? 1);
			}
			await manager.query(`INSERT INTO "event_outbox" ("id", "eventName", "partitionKey", "sequence") VALUES (?, ?, ?, ?)`, [
				randomUUID(),
				input.name,
				partitionKey,
				sequence
			]);
			return { sequence } as unknown as EventOutbox;
		})
	};
	return { outbox: outbox as unknown as EventOutboxService & { append: jest.Mock }, state };
}

const fact = (name = 'chat_member.state_changed'): IOutboxWriteInput => ({
	name,
	aggregateType: 'chat_conversation',
	aggregateId: '6b1e0f2a-0000-4000-8000-0000000000c1',
	tenantId: 'ten',
	organizationId: 'org',
	data: { conversationId: 'c1', recipientUserIds: ['u1'] }
});

describe('appendInTransaction', () => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		await dataSource.query(`CREATE TABLE "event_outbox" ("id" varchar PRIMARY KEY NOT NULL, "eventName" varchar NOT NULL, "partitionKey" varchar, "sequence" integer NOT NULL)`);
		await dataSource.query(`CREATE UNIQUE INDEX "${OUTBOX_PARTITION_SEQUENCE_INDEX}" ON "event_outbox" ("partitionKey", "sequence") WHERE "partitionKey" IS NOT NULL`);
		await dataSource.query(`CREATE TABLE "chat_write" ("id" varchar PRIMARY KEY NOT NULL)`);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await dataSource.query(`DELETE FROM "event_outbox"`);
		await dataSource.query(`DELETE FROM "chat_write"`);
	});

	const rows = async () => (await dataSource.query(`SELECT "eventName", "sequence" FROM "event_outbox" ORDER BY "sequence"`)) as Array<{ eventName: string; sequence: number }>;
	const writes = async () => ((await dataSource.query(`SELECT "id" FROM "chat_write"`)) as Array<{ id: string }>).map((row) => row.id);

	it('commits the fact with the write', async () => {
		const { outbox } = outboxOver();
		await dataSource.transaction(async (manager) => {
			await manager.query(`INSERT INTO "chat_write" ("id") VALUES ('w1')`);
			await appendInTransaction(outbox, manager, fact());
		});
		expect(await writes()).toEqual(['w1']);
		expect(await rows()).toEqual([{ eventName: 'chat_member.state_changed', sequence: 1 }]);
	});

	it('rolls the fact back with a write that fails after it (no event for a write that never happened)', async () => {
		const { outbox } = outboxOver();
		await expect(
			dataSource.transaction(async (manager) => {
				await manager.query(`INSERT INTO "chat_write" ("id") VALUES ('w1')`);
				await appendInTransaction(outbox, manager, fact());
				throw new Error('the write failed after its fact was appended');
			})
		).rejects.toThrow('the write failed');
		expect(await writes()).toEqual([]);
		expect(await rows()).toEqual([]);
	});

	it('takes the next position when another transaction took the one it read, and keeps the write', async () => {
		const { outbox, state } = outboxOver();
		await dataSource.transaction(async (manager) => appendInTransaction(outbox, manager, fact('chat_conversation.changed')));
		// The next append reads the position the first one took, as a transaction that read MAX before the other's commit.
		state.stale = 1;
		await dataSource.transaction(async (manager) => {
			await manager.query(`INSERT INTO "chat_write" ("id") VALUES ('w2')`);
			await appendInTransaction(outbox, manager, fact());
			// The write's own statements after the append still run in the same, unaborted transaction.
			await manager.query(`INSERT INTO "chat_write" ("id") VALUES ('w3')`);
		});
		expect(outbox.append).toHaveBeenCalledTimes(3);
		expect(await writes()).toEqual(['w2', 'w3']);
		expect(await rows()).toEqual([
			{ eventName: 'chat_conversation.changed', sequence: 1 },
			{ eventName: 'chat_member.state_changed', sequence: 2 }
		]);
	});

	it('fails the write when the race keeps being lost, rather than dropping the fact', async () => {
		const { outbox, state } = outboxOver();
		await dataSource.transaction(async (manager) => appendInTransaction(outbox, manager, fact('chat_conversation.changed')));
		state.stale = OUTBOX_APPEND_ATTEMPTS;
		await expect(
			dataSource.transaction(async (manager) => {
				await manager.query(`INSERT INTO "chat_write" ("id") VALUES ('w4')`);
				await appendInTransaction(outbox, manager, fact());
			})
		).rejects.toThrow('UNIQUE constraint failed');
		expect(outbox.append).toHaveBeenCalledTimes(1 + OUTBOX_APPEND_ATTEMPTS);
		expect(await writes()).toEqual([]);
		expect(await rows()).toEqual([{ eventName: 'chat_conversation.changed', sequence: 1 }]);
	});

	it('does not try again after any other failure', async () => {
		const outbox = { append: jest.fn(async () => Promise.reject(new Error('relation "event_outbox" does not exist'))) } as unknown as EventOutboxService & { append: jest.Mock };
		await expect(dataSource.transaction(async (manager) => appendInTransaction(outbox, manager, fact()))).rejects.toThrow('does not exist');
		expect(outbox.append).toHaveBeenCalledTimes(1);
	});

	it('refuses a manager without an open transaction (the row would commit on its own)', async () => {
		const { outbox } = outboxOver();
		await expect(appendInTransaction(outbox, dataSource.manager, fact())).rejects.toThrow('open transaction');
		expect(outbox.append).not.toHaveBeenCalled();
	});
});

describe('isPartitionSequenceConflict', () => {
	it('recognises the partition index on each dialect, wrapped by TypeORM or not', () => {
		expect(isPartitionSequenceConflict({ driverError: { code: '23505', constraint: OUTBOX_PARTITION_SEQUENCE_INDEX } })).toBe(true);
		expect(isPartitionSequenceConflict({ code: '23505', message: `duplicate key value violates unique constraint "${OUTBOX_PARTITION_SEQUENCE_INDEX}"` })).toBe(true);
		expect(isPartitionSequenceConflict({ driverError: { code: 'ER_DUP_ENTRY', message: `Duplicate entry 'x-2' for key 'event_outbox.${OUTBOX_PARTITION_SEQUENCE_INDEX}'` } })).toBe(true);
		expect(isPartitionSequenceConflict(new Error('UNIQUE constraint failed: event_outbox.partitionKey, event_outbox.sequence'))).toBe(true);
	});

	it('does not mistake another unique key or another failure for it', () => {
		expect(isPartitionSequenceConflict({ driverError: { code: '23505', constraint: 'UQ_event_outbox_event' } })).toBe(false);
		expect(isPartitionSequenceConflict({ driverError: { code: 'ER_DUP_ENTRY', message: "Duplicate entry 'x' for key 'event_outbox.UQ_event_outbox_event'" } })).toBe(false);
		expect(isPartitionSequenceConflict(new Error('UNIQUE constraint failed: event_outbox.eventId'))).toBe(false);
		expect(isPartitionSequenceConflict(new Error('connection lost'))).toBe(false);
		expect(isPartitionSequenceConflict(null)).toBe(false);
	});
});
