import { DataSource, EntityManager } from 'typeorm';

/**
 * Runs a chat write in a transaction whose reads see what other transactions committed since it began (`READ
 * COMMITTED`), as Postgres's default does.
 *
 * The write appends its facts to the outbox inside it (`appendInTransaction`), and an append that lost a partition race
 * is tried again in a savepoint: the next attempt must read the position the other transaction committed. MySQL's
 * default (`REPEATABLE READ`) keeps the snapshot of the transaction's first read, so every attempt would read the old
 * position and collide again; there the transaction is opened `READ COMMITTED`. Postgres already reads that way, and
 * SQLite has one writer at a time, so both keep their default.
 *
 * @param dataSource The platform's data source.
 * @param work The write, handed the transaction's manager.
 */
export function inWriteTransaction<T>(dataSource: DataSource, work: (manager: EntityManager) => Promise<T>): Promise<T> {
	const type = String((dataSource as { options?: { type?: unknown } }).options?.type ?? '');
	if (type === 'mysql' || type === 'mariadb') {
		return dataSource.transaction('READ COMMITTED', work);
	}
	return dataSource.transaction(work);
}

/**
 * Whether the database takes row locks (`SELECT … FOR UPDATE` / `FOR SHARE`): Postgres and MySQL. SQLite has one
 * writer at a time and refuses TypeORM's lock modes, so a read there takes none.
 *
 * @param dataSource The platform's data source.
 */
export function chatLocksRows(dataSource: DataSource): boolean {
	const type = String((dataSource as { options?: { type?: unknown } }).options?.type ?? '');
	return type === 'postgres' || type === 'mysql' || type === 'mariadb';
}
