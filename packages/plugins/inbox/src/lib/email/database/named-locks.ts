import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

/** How long a MySQL caller waits for a named lock before it gives up. */
const MYSQL_LOCK_WAIT_SECONDS = 30;

/**
 * Named locks: `run(name, work)` runs `work` while no other holder of `name` runs, in this process (a promise chain
 * per name) and across the replicas (on PostgreSQL a transaction-scoped advisory lock, on MySQL `GET_LOCK`, each held
 * on a connection of its own for the work's duration; SQLite has a single writer, the chain is enough).
 *
 * The work uses the ordinary connections, so its writes are committed before the lock is let go. The database name
 * of a lock is a digest of `name` (MySQL allows 64 characters).
 *
 * Keep the work short (a check and a save): on PostgreSQL the lock's connection is idle in its transaction while the
 * work runs, so a server `idle_in_transaction_session_timeout` shorter than the work would end the session and let
 * the lock go early (the work still finishes; only the serialisation would be lost).
 */
export class InboxNamedLocks {
	private readonly chains = new Map<string, Promise<unknown>>();

	constructor(private readonly dataSource: DataSource) {}

	async run<T>(name: string, work: () => Promise<T>): Promise<T> {
		const previous = this.chains.get(name) ?? Promise.resolve();
		const run = previous.catch(() => undefined).then(() => this.acrossReplicas(name, work));
		this.chains.set(name, run);
		try {
			return await run;
		} finally {
			if (this.chains.get(name) === run) this.chains.delete(name);
		}
	}

	private async acrossReplicas<T>(name: string, work: () => Promise<T>): Promise<T> {
		const type = String(this.dataSource.options.type);
		const postgres = type === 'postgres';
		const mysql = type === 'mysql' || type === 'mariadb';
		if (!postgres && !mysql) return work();
		const key = `gauzy-inbox:${createHash('sha256').update(name).digest('hex').slice(0, 40)}`;
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			if (postgres) {
				// Released when the transaction ends, whatever happens to the work (or the connection). It holds nothing
				// but the lock: committed after the work, rolled back when the work failed.
				await runner.startTransaction();
				let result: T;
				try {
					await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
					result = await work();
				} catch (error) {
					await runner.rollbackTransaction().catch(() => undefined);
					throw error;
				}
				await runner.commitTransaction().catch(() => runner.rollbackTransaction().catch(() => undefined));
				return result;
			}
			const [row] = (await runner.query('SELECT GET_LOCK(?, ?) AS locked', [
				key,
				MYSQL_LOCK_WAIT_SECONDS
			])) as Array<{
				locked?: unknown;
			}>;
			if (Number(row?.locked) !== 1) {
				throw new ConflictException('Another request is changing the same thing; try again.');
			}
			try {
				return await work();
			} finally {
				await runner.query('SELECT RELEASE_LOCK(?)', [key]).catch(() => undefined);
			}
		} finally {
			await runner.release();
		}
	}
}
