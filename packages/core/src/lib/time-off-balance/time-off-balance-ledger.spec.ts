// Must stay first: loads the entity graph before the ledger pulls an entity.
import '../core/entities/internal';

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { In } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { TimeOffBalance } from '../core/entities/internal';
import { mikroOrmTimeOffBalanceLedger, typeOrmTimeOffBalanceLedger } from './time-off-balance-ledger';

/**
 * The balance row locks a decision or a write of a time-off request takes before it moves days on any balance (#11608
 * review): one statement per transaction phase that locks every balance it will move, in the order of their ids, so
 * two transactions moving days on the same balances cannot each hold one the other waits for.
 *
 * SQLite has no row locks (its transactions are serialized), so the statement is only sent on PostgreSQL and MySQL,
 * which is what these doubles stand in for; what the locks protect is covered on real databases in
 * `time-off-balance-ledger.orm-parity.spec.ts`.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => true),
	isMySQL: jest.fn(() => false)
}));

const TENANT = 'tenant-a';

/** A query builder double that records every call, and answers each with itself. */
function recordingQueryBuilder(calls: Array<[string, ...unknown[]]>, result: unknown) {
	const builder: Record<string, jest.Mock> = {};
	for (const method of ['select', 'where', 'orderBy', 'setLock', 'setLockMode']) {
		builder[method] = jest.fn((...args: unknown[]) => {
			calls.push([method, ...args]);
			return builder;
		});
	}
	builder['getMany'] = jest.fn(async () => {
		calls.push(['getMany']);
		return result;
	});
	builder['execute'] = jest.fn(async (...args: unknown[]) => {
		calls.push(['execute', ...args]);
		return result;
	});
	return builder;
}

describe('ITimeOffBalanceLedger.lockBalances', () => {
	afterEach(() => {
		(isPostgres as jest.Mock).mockReturnValue(true);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	describe('on TypeORM', () => {
		const setUp = () => {
			const calls: Array<[string, ...unknown[]]> = [];
			const builder = recordingQueryBuilder(calls, []);
			const manager = { createQueryBuilder: jest.fn(() => builder) };
			return { calls, manager, ledger: typeOrmTimeOffBalanceLedger(manager as any) };
		};

		it('locks every balance named, once each, in one statement ordered by id (FOR UPDATE)', async () => {
			const { calls, manager, ledger } = setUp();

			await ledger.lockBalances(['balance-b', 'balance-a', 'balance-b'], TENANT);

			expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
			expect(manager.createQueryBuilder).toHaveBeenCalledWith(TimeOffBalance, 'time_off_balance');
			expect(calls).toEqual([
				['select', 'time_off_balance.id'],
				['where', { id: In(['balance-b', 'balance-a']), tenantId: TENANT }],
				['orderBy', 'time_off_balance.id', 'ASC'],
				['setLock', 'pessimistic_write'],
				['getMany']
			]);
		});

		it('locks on MySQL as on PostgreSQL', async () => {
			(isPostgres as jest.Mock).mockReturnValue(false);
			(isMySQL as jest.Mock).mockReturnValue(true);
			const { calls, ledger } = setUp();

			await ledger.lockBalances(['balance-a'], TENANT);

			expect(calls).toContainEqual(['setLock', 'pessimistic_write']);
		});

		it('sends nothing on SQLite, or for no balance', async () => {
			const { manager, ledger } = setUp();
			await ledger.lockBalances([], TENANT);

			(isPostgres as jest.Mock).mockReturnValue(false);
			await ledger.lockBalances(['balance-a'], TENANT);

			expect(manager.createQueryBuilder).not.toHaveBeenCalled();
		});
	});

	describe('on MikroORM', () => {
		const setUp = () => {
			const calls: Array<[string, ...unknown[]]> = [];
			const builder = recordingQueryBuilder(calls, []);
			const em: Record<string, jest.Mock> = { createQueryBuilder: jest.fn(() => builder) };
			em['getContext'] = jest.fn(() => em);
			return { calls, em, ledger: mikroOrmTimeOffBalanceLedger(em as any) };
		};

		it('locks every live balance named, once each, in one statement ordered by id (FOR UPDATE)', async () => {
			const { calls, em, ledger } = setUp();

			await ledger.lockBalances(['balance-b', 'balance-a', 'balance-a'], TENANT);

			expect(em.createQueryBuilder).toHaveBeenCalledTimes(1);
			expect(em.createQueryBuilder).toHaveBeenCalledWith(TimeOffBalance);
			expect(calls).toEqual([
				['select', 'id'],
				['where', { id: { $in: ['balance-b', 'balance-a'] }, tenantId: TENANT, deletedAt: null }],
				['orderBy', { id: QueryOrder.ASC }],
				['setLockMode', LockMode.PESSIMISTIC_WRITE],
				['execute', 'all']
			]);
		});

		it('sends nothing on SQLite', async () => {
			(isPostgres as jest.Mock).mockReturnValue(false);
			const { em, ledger } = setUp();

			await ledger.lockBalances(['balance-a'], TENANT);

			expect(em.createQueryBuilder).not.toHaveBeenCalled();
		});
	});
});
