import { FilterQuery, LockMode } from '@mikro-orm/core';
import { FindOptionsSelect, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { MultiORM, MultiORMEnum } from '../../core/utils';
import type { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { assertTrackingSwitchAsSeen } from './tracking-switch-rule';

/** A service's own repositories, one per ORM: the row they serve holds an `isTrackingEnabled` switch. */
export interface ITrackingSwitchRepositories<E extends ObjectLiteral> {
	typeOrm: Repository<E>;
	/** Its entity manager, which the service's writes follow into a transaction, and the entity it serves. */
	mikroOrm: Pick<MikroOrmBaseEntityRepository<object>, 'getEntityManager' | 'getEntityName'>;
}

/** The switch as a locked read answers it. */
interface IStoredTrackingSwitch {
	isTrackingEnabled?: boolean | null;
}

/**
 * Whether the database locks the rows a write reads: PostgreSQL and MySQL do. SQLite runs one writer at a time, and
 * TypeORM refuses a row lock there.
 */
function locksRows(): boolean {
	return isPostgres() || isMySQL();
}

/** The members of a condition that are stated: an undefined one is no condition, and neither ORM is given it. */
function statedMembers(row: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

/**
 * Runs a write under the tracking switch the caller's screen showed (`expectedIsTrackingEnabled`,
 * ever-co/ever-gauzy#11830), with the comparison and the write as one.
 *
 * Checked only before the write, the switch could change in between: another admin's save landing after that check
 * was undone by this one, for example tracking turned back on by a save that sends the switch as its screen showed it.
 * Here the write runs in one transaction on the ORM the installation runs. The row is read again first in it, locked
 * where the database locks rows (PostgreSQL, MySQL): another request's write to it is waited for, and seen. Its switch
 * is compared with the expectation, and the write is made in the same transaction only when the two are the same.
 * Otherwise the 409 `TRACKING_SWITCH_CHANGED` rolls the transaction back, and nothing is written.
 *
 * On TypeORM the write is handed a view of the service whose repository is the transaction's, so the CRUD base's
 * writes, and their checks, run in it (as `inLinesTransaction` does for an invoice's lines). On MikroORM the service's
 * repositories follow the transaction on their own.
 *
 * Without an expectation the write runs as before: on the service itself, in no transaction of this one's.
 *
 * @param service The service that writes the row.
 * @param repositories The service's own repositories.
 * @param row The row's id and the scope the write names it in. Undefined members are left out.
 * @param isStoredOn How the stored switch reads: an employee's switch without a value reads as off, a team member's
 * as on, as the timer reads each.
 * @param expected The switch the caller's screen showed; undefined or null runs the write as before.
 * @param write The write, made on the service it is given.
 * @returns What the write answered.
 * @throws ConflictException With the code TRACKING_SWITCH_CHANGED when the stored switch differs; nothing is written.
 */
export async function writeUnderTrackingSwitchAsSeen<S extends { ormType: MultiORM }, E extends ObjectLiteral, R>(
	service: S,
	repositories: ITrackingSwitchRepositories<E>,
	row: Record<string, unknown>,
	isStoredOn: (isTrackingEnabled: boolean | null | undefined) => boolean,
	expected: boolean | null | undefined,
	write: (service: S) => Promise<R>
): Promise<R> {
	if (expected === undefined || expected === null) {
		return await write(service);
	}
	const where = statedMembers(row);
	// A row the locked read does not find is the write's to answer, as it answered it before.
	const assertAsSeen = (stored: IStoredTrackingSwitch | null) => {
		if (stored) {
			assertTrackingSwitchAsSeen(isStoredOn(stored.isTrackingEnabled), expected);
		}
	};

	if (service.ormType === MultiORMEnum.MikroORM) {
		const entityManager = repositories.mikroOrm.getEntityManager();
		return await entityManager.transactional(async (em) => {
			// Read apart from the identity map, which may hold the request's earlier read of the row.
			const stored = await em.findOne(repositories.mikroOrm.getEntityName(), where as FilterQuery<E>, {
				fields: ['id', 'isTrackingEnabled'] as never,
				disableIdentityMap: true,
				lockMode: locksRows() ? LockMode.PESSIMISTIC_WRITE : undefined
			});
			assertAsSeen(stored as IStoredTrackingSwitch | null);
			return await write(service);
		});
	}

	return await repositories.typeOrm.manager.transaction(async (manager) => {
		const stored = await manager.findOne(repositories.typeOrm.target, {
			where: where as FindOptionsWhere<E>,
			select: { id: true, isTrackingEnabled: true } as unknown as FindOptionsSelect<E>,
			loadEagerRelations: false,
			...(locksRows() ? { lock: { mode: 'pessimistic_write' as const } } : {})
		});
		assertAsSeen(stored as IStoredTrackingSwitch | null);
		const inTransaction: S = Object.create(service, {
			typeOrmRepository: { value: manager.getRepository(repositories.typeOrm.target), configurable: true }
		});
		return await write(inTransaction);
	});
}
