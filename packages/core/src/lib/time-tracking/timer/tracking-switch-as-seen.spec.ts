// The database in use decides the row lock: PostgreSQL here, unless a case says otherwise.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => true),
	isMySQL: jest.fn(() => false)
}));

import { ConflictException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import { MultiORM } from '../../core/utils';
import { TRACKING_SWITCH_CHANGED } from './tracking-switch-rule';
import { writeUnderTrackingSwitchAsSeen } from './tracking-switch-as-seen';

/**
 * The lock and the transaction around a save made under the tracking switch its screen showed (Greptile on
 * ever-co/ever-gauzy#12039). SQLite takes no row lock, so the dual-ORM spec cannot show the lock itself: here each ORM
 * is handed a transaction that records what it is asked, and the database is PostgreSQL or MySQL.
 */
describe('writeUnderTrackingSwitchAsSeen', () => {
	class Membership {}

	const row = {
		id: 'member-1',
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		organizationTeamId: undefined
	};
	const isStoredOn = (isTrackingEnabled: boolean | null | undefined) => isTrackingEnabled !== false;

	let stored: { id: string; isTrackingEnabled: boolean | null } | null;
	let typeOrmFindOne: jest.Mock;
	let typeOrmTransaction: jest.Mock;
	let transactionRepository: object;
	let getRepository: jest.Mock;
	let mikroOrmFindOne: jest.Mock;
	let mikroOrmTransactional: jest.Mock;

	const serviceOn = (ormType: MultiORM) => ({ ormType, name: 'service' });

	const repositories = () => {
		transactionRepository = { inTransaction: true };
		typeOrmFindOne = jest.fn(async () => stored);
		getRepository = jest.fn(() => transactionRepository);
		const manager = { findOne: typeOrmFindOne, getRepository };
		typeOrmTransaction = jest.fn(async (work: (manager: unknown) => unknown) => work(manager));
		mikroOrmFindOne = jest.fn(async () => stored);
		mikroOrmTransactional = jest.fn(async (work: (em: unknown) => unknown) => work({ findOne: mikroOrmFindOne }));
		return {
			typeOrm: { target: Membership, manager: { transaction: typeOrmTransaction } } as never,
			mikroOrm: {
				getEntityManager: () => ({ transactional: mikroOrmTransactional }),
				getEntityName: () => 'Membership'
			} as never
		};
	};

	/** The refusal's code, or undefined when the write went through. */
	const refusalCodeOf = async (work: Promise<unknown>): Promise<string | undefined> => {
		try {
			await work;
			return undefined;
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictException);
			return (error as ConflictException).getResponse()['code'];
		}
	};

	beforeEach(() => {
		stored = { id: 'member-1', isTrackingEnabled: true };
		jest.mocked(isPostgres).mockReturnValue(true);
		jest.mocked(isMySQL).mockReturnValue(false);
	});

	afterEach(() => jest.clearAllMocks());

	it('runs a write without an expectation as before: on the service, in no transaction and with no read', async () => {
		const service = serviceOn('typeorm');
		const write = jest.fn(async (on: unknown) => on);
		const repos = repositories();

		expect(await writeUnderTrackingSwitchAsSeen(service, repos, row, isStoredOn, undefined, write)).toBe(service);
		expect(await writeUnderTrackingSwitchAsSeen(service, repos, row, isStoredOn, null, write)).toBe(service);
		expect(typeOrmTransaction).not.toHaveBeenCalled();
		expect(mikroOrmTransactional).not.toHaveBeenCalled();
	});

	it('joins another service as it is when there is no transaction', async () => {
		const other = { name: 'activity log' };

		const joined = await writeUnderTrackingSwitchAsSeen(
			serviceOn('typeorm'),
			repositories(),
			row,
			isStoredOn,
			undefined,
			async (_service, join) => join(other)
		);

		expect(joined).toBe(other);
	});

	describe('on TypeORM', () => {
		it('reads the row for update in the transaction, in the scope stated, and writes on its repository', async () => {
			const service = serviceOn('typeorm');
			const write = jest.fn(async (on: typeof service) => on as typeof service & { typeOrmRepository?: object });

			const inTransaction = await writeUnderTrackingSwitchAsSeen(
				service,
				repositories(),
				row,
				isStoredOn,
				true,
				write
			);

			expect(typeOrmTransaction).toHaveBeenCalledTimes(1);
			const [target, options] = typeOrmFindOne.mock.calls[0];
			expect(target).toBe(Membership);
			expect(options.where).toEqual({ id: 'member-1', tenantId: 'tenant-1', organizationId: 'organization-1' });
			expect(options.lock).toEqual({ mode: 'pessimistic_write' });
			// The write is made on a view of the service whose repository is the transaction's
			expect(inTransaction).not.toBe(service);
			expect(inTransaction.typeOrmRepository).toBe(transactionRepository);
			expect(inTransaction.name).toBe('service');
		});

		it("joins another service to the transaction: a view of it on the transaction's repository for its entity", async () => {
			class ActivityLog {}
			const other = { name: 'activity log', typeOrmRepository: { target: ActivityLog } };

			const joined = await writeUnderTrackingSwitchAsSeen(
				serviceOn('typeorm'),
				repositories(),
				row,
				isStoredOn,
				true,
				async (_service, join) => join(other)
			);

			expect(getRepository).toHaveBeenLastCalledWith(ActivityLog);
			expect(joined).not.toBe(other);
			expect(joined.typeOrmRepository).toBe(transactionRepository);
			expect(joined.name).toBe('activity log');
		});

		it('refuses to join a service without a TypeORM repository, whose writes could not be in the transaction', async () => {
			const refusal = await writeUnderTrackingSwitchAsSeen(
				serviceOn('typeorm'),
				repositories(),
				row,
				isStoredOn,
				true,
				async (_service, join) => join({ name: 'no repository' })
			).catch((error: Error) => error);

			expect(refusal).toBeInstanceOf(Error);
		});

		it('locks on MySQL as well, and takes no lock on SQLite, which TypeORM refuses there', async () => {
			jest.mocked(isPostgres).mockReturnValue(false);
			jest.mocked(isMySQL).mockReturnValue(true);
			const service = serviceOn('typeorm');
			await writeUnderTrackingSwitchAsSeen(service, repositories(), row, isStoredOn, true, async () => null);
			expect(typeOrmFindOne.mock.calls[0][1].lock).toEqual({ mode: 'pessimistic_write' });

			jest.mocked(isMySQL).mockReturnValue(false);
			await writeUnderTrackingSwitchAsSeen(service, repositories(), row, isStoredOn, true, async () => null);
			expect(typeOrmFindOne.mock.calls[0][1]).not.toHaveProperty('lock');
		});

		it('refuses with 409 and writes nothing when the locked row holds another switch', async () => {
			stored = { id: 'member-1', isTrackingEnabled: false };
			const write = jest.fn();

			const code = await refusalCodeOf(
				writeUnderTrackingSwitchAsSeen(serviceOn('typeorm'), repositories(), row, isStoredOn, true, write)
			);

			expect(code).toBe(TRACKING_SWITCH_CHANGED);
			expect(write).not.toHaveBeenCalled();
		});

		it('reads the stored switch as the caller says it reads: no value is on for a team member', async () => {
			stored = { id: 'member-1', isTrackingEnabled: null };
			const write = jest.fn(async () => 'written');

			expect(
				await writeUnderTrackingSwitchAsSeen(serviceOn('typeorm'), repositories(), row, isStoredOn, true, write)
			).toBe('written');
		});

		it('leaves a row the locked read does not find to the write, which answers it as before', async () => {
			stored = null;
			const write = jest.fn(async () => 'answered');

			expect(
				await writeUnderTrackingSwitchAsSeen(
					serviceOn('typeorm'),
					repositories(),
					row,
					isStoredOn,
					false,
					write
				)
			).toBe('answered');
		});
	});

	describe('on MikroORM', () => {
		it('reads the row for update in the transaction, apart from the identity map, and writes on the service', async () => {
			const service = serviceOn('mikro-orm');
			const write = jest.fn(async (on: unknown) => on);

			const writtenOn = await writeUnderTrackingSwitchAsSeen(
				service,
				repositories(),
				row,
				isStoredOn,
				true,
				write
			);

			expect(mikroOrmTransactional).toHaveBeenCalledTimes(1);
			const [entityName, where, options] = mikroOrmFindOne.mock.calls[0];
			expect(entityName).toBe('Membership');
			expect(where).toEqual({ id: 'member-1', tenantId: 'tenant-1', organizationId: 'organization-1' });
			expect(options).toMatchObject({ lockMode: LockMode.PESSIMISTIC_WRITE, disableIdentityMap: true });
			// The service's repositories follow the transaction on their own
			expect(writtenOn).toBe(service);
		});

		it('joins another service as it is: its repositories follow the transaction on their own', async () => {
			const other = { name: 'activity log' };

			const joined = await writeUnderTrackingSwitchAsSeen(
				serviceOn('mikro-orm'),
				repositories(),
				row,
				isStoredOn,
				true,
				async (_service, join) => join(other)
			);

			expect(joined).toBe(other);
		});

		it('takes no lock on SQLite', async () => {
			jest.mocked(isPostgres).mockReturnValue(false);

			await writeUnderTrackingSwitchAsSeen(
				serviceOn('mikro-orm'),
				repositories(),
				row,
				isStoredOn,
				true,
				async () => null
			);

			expect(mikroOrmFindOne.mock.calls[0][2].lockMode).toBeUndefined();
		});

		it('refuses with 409 and writes nothing when the locked row holds another switch', async () => {
			stored = { id: 'member-1', isTrackingEnabled: true };
			const write = jest.fn();

			const code = await refusalCodeOf(
				writeUnderTrackingSwitchAsSeen(serviceOn('mikro-orm'), repositories(), row, isStoredOn, false, write)
			);

			expect(code).toBe(TRACKING_SWITCH_CHANGED);
			expect(write).not.toHaveBeenCalled();
		});
	});
});
