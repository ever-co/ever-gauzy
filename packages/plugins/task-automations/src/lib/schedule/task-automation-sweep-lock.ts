import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

/**
 * The names held in this process, shared by every lock object: a job provider the scheduler builds in an injector of
 * its own holds a lock object of its own, and must still see the names the API's services hold.
 */
const HELD_IN_PROCESS = new Set<string>();

/**
 * A named lock held across the processes, taken without waiting: a second holder that finds it held does nothing (the
 * first is doing the work). PostgreSQL: a transaction-scoped advisory lock on a connection of its own; MySQL:
 * `GET_LOCK(…, 0)`; SQLite (one process): a flag in this process. The due sweep holds one; each task's runs hold
 * another (`TaskAutomationTaskLock`).
 */
export class TaskAutomationSweepLock {
	constructor(private readonly dataSource: DataSource) {}

	/** Runs `work` when the lock is free and answers its result, or `null` when another holder has it. */
	async tryRun<T>(name: string, work: () => Promise<T>): Promise<T | null> {
		if (HELD_IN_PROCESS.has(name)) return null;
		HELD_IN_PROCESS.add(name);
		try {
			return await this.acrossProcesses(name, work);
		} finally {
			HELD_IN_PROCESS.delete(name);
		}
	}

	private async acrossProcesses<T>(name: string, work: () => Promise<T>): Promise<T | null> {
		const type = String(this.dataSource.options.type);
		const postgres = type === 'postgres';
		const mysql = type === 'mysql' || type === 'mariadb';
		if (!postgres && !mysql) return work();
		const key = `gauzy-task-automations:${createHash('sha256').update(name).digest('hex').slice(0, 40)}`;
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			if (postgres) {
				await runner.startTransaction();
				try {
					const [row] = (await runner.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked', [key])) as Array<{ locked?: unknown }>;
					if (row?.locked !== true && String(row?.locked) !== 't' && String(row?.locked) !== 'true') {
						await runner.rollbackTransaction().catch(() => undefined);
						return null;
					}
					const result = await work();
					await runner.commitTransaction().catch(() => runner.rollbackTransaction().catch(() => undefined));
					return result;
				} catch (error) {
					await runner.rollbackTransaction().catch(() => undefined);
					throw error;
				}
			}
			const [row] = (await runner.query('SELECT GET_LOCK(?, 0) AS locked', [key])) as Array<{ locked?: unknown }>;
			if (Number(row?.locked) !== 1) return null;
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
