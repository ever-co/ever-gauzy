import { DataSource } from 'typeorm';
import { inWriteTransaction } from './chat-write-transaction';

/** A data source of one dialect whose transaction records the isolation it was asked for. */
function dataSourceOf(type: string) {
	const transaction = jest.fn(async (...args: unknown[]) => {
		const work = args[args.length - 1] as (manager: unknown) => Promise<unknown>;
		return work({ type });
	});
	return { dataSource: { options: { type }, transaction } as unknown as DataSource, transaction };
}

describe('inWriteTransaction', () => {
	it('reads committed data on MySQL, so a retried append sees the position another transaction took', async () => {
		for (const type of ['mysql', 'mariadb']) {
			const { dataSource, transaction } = dataSourceOf(type);
			await expect(inWriteTransaction(dataSource, async (manager) => manager)).resolves.toEqual({ type });
			expect(transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
		}
	});

	it('keeps the default elsewhere (Postgres already reads committed data; SQLite has one writer)', async () => {
		for (const type of ['postgres', 'better-sqlite3', 'sqlite']) {
			const { dataSource, transaction } = dataSourceOf(type);
			await inWriteTransaction(dataSource, async () => 'done');
			expect(transaction).toHaveBeenCalledWith(expect.any(Function));
			expect(transaction.mock.calls[0]).toHaveLength(1);
		}
	});
});
