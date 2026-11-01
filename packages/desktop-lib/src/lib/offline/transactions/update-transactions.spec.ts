jest.mock('electron', () => ({ app: { getPath: () => '', getVersion: () => '0.0.0' }, shell: {} }), { virtual: true });
jest.mock('@sentry/electron/main', () => ({ captureException: jest.fn() }), { virtual: true });

import { IDatabaseProvider } from '../../interfaces';
import {
	AuditLogTransaction,
	AuditQueueTransaction,
	IntervalTransaction,
	KbMouseTransaction,
	ProjectTransaction,
	TaskTransaction,
	TimerTransaction,
	UserTransaction
} from '.';

/**
 * An UPDATE of the local database whose values are all `undefined` made Knex throw "Empty .update() call
 * detected!" (#7811): Knex leaves undefined values out and refuses an UPDATE with nothing left. Every transaction
 * now skips such an update (no transaction opened, a warning logged) and writes only the defined values otherwise.
 *
 * Knex is replaced by a recording fake: the query builder the transactions chain on, and a connection that runs the
 * transaction callback with it.
 */
function fakeDatabase() {
	const row = { id: 1, queue_id: 'q-1', status: 'completed' };
	const builder: Record<string, jest.Mock> = {};
	for (const method of ['where', 'update']) {
		builder[method] = jest.fn(() => builder);
	}
	builder.returning = jest.fn(async () => [row]);
	builder.first = jest.fn(async () => row);
	const trx = Object.assign(
		jest.fn(() => builder),
		{ commit: jest.fn(), rollback: jest.fn() }
	);
	const connection = Object.assign(
		jest.fn(() => builder),
		{ transaction: jest.fn(async (callback: (t: typeof trx) => unknown) => callback(trx)) }
	);
	return { provider: { connection } as unknown as IDatabaseProvider, connection, builder, row };
}

type UpdatableTransaction = { update(id: number, value: object): Promise<void> };

const transactions: Array<[string, new (provider: IDatabaseProvider) => UpdatableTransaction]> = [
	['TimerTransaction', TimerTransaction],
	['IntervalTransaction', IntervalTransaction],
	['KbMouseTransaction', KbMouseTransaction],
	['ProjectTransaction', ProjectTransaction],
	['TaskTransaction', TaskTransaction],
	['UserTransaction', UserTransaction],
	['AuditLogTransaction', AuditLogTransaction],
	['AuditQueueTransaction', AuditQueueTransaction]
];

describe('offline transactions: update()', () => {
	let warn: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => warn.mockRestore());

	it.each(transactions)('%s skips an update whose values are all undefined', async (_, Transaction) => {
		const db = fakeDatabase();

		await expect(
			new Transaction(db.provider).update(5, { id: 5, projectId: undefined, taskId: undefined })
		).resolves.toBeUndefined();

		expect(db.connection.transaction).not.toHaveBeenCalled();
		expect(db.builder.update).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it.each(transactions)('%s writes only the defined values', async (_, Transaction) => {
		const db = fakeDatabase();

		await new Transaction(db.provider).update(5, { id: 5, synced: true, timelogId: null, taskId: undefined });

		expect(db.connection.transaction).toHaveBeenCalledTimes(1);
		expect(db.builder.update).toHaveBeenCalledWith({ synced: true, timelogId: null });
		expect(warn).not.toHaveBeenCalled();
	});

	it('AuditQueueTransaction never rewrites the queue_id it addresses the row by', async () => {
		const db = fakeDatabase();

		await new AuditQueueTransaction(db.provider).update(5, { queue_id: 'q-1', status: 'completed' } as never);

		expect(db.builder.where).toHaveBeenCalledWith('queue_id', '=', 5);
		expect(db.builder.update).toHaveBeenCalledWith({ status: 'completed' });
	});

	describe('AuditQueueTransaction.updatePartial()', () => {
		it('answers the row as it stands, without an UPDATE, when there is nothing to write', async () => {
			const db = fakeDatabase();

			const row = await new AuditQueueTransaction(db.provider).updatePartial(1, { queue_id: 'q-1' } as never);

			expect(row).toBe(db.row);
			expect(db.builder.where).toHaveBeenCalledWith('queue_id', '=', 1);
			expect(db.connection.transaction).not.toHaveBeenCalled();
			expect(db.builder.update).not.toHaveBeenCalled();
		});

		it('updates and answers the updated row otherwise', async () => {
			const db = fakeDatabase();

			const row = await new AuditQueueTransaction(db.provider).updatePartial(1, {
				queue_id: 'q-1',
				status: 'completed',
				last_error: undefined
			} as never);

			expect(db.builder.update).toHaveBeenCalledWith({ status: 'completed' });
			expect(row).toBe(db.row);
		});
	});
});
