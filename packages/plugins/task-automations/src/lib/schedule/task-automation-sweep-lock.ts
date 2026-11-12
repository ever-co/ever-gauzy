import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * The names held in this process, shared by every lock object: a job provider the scheduler builds in an injector of
 * its own holds a lock object of its own, and must still see the names the API's services hold.
 */
const HELD_IN_PROCESS = new Set<string>();

/** The lock connections this process holds, and the holders waiting for one (they hold no connection meanwhile). */
const LOCK_CONNECTIONS = { inUse: 0, waiting: [] as Array<() => void> };

/**
 * How many lock connections this process may hold at once: half the pool, at most 4 (the onboarding lock's rule), so
 * the lock connections never take the connections their own work reads through. A lock taken inside another (the due
 * sweep runs each task under that task's lock) needs two, so a pool too small to spare two serializes in the process
 * only. A stated size of 0 (or none) is the driver's default, 10.
 */
export function lockConnectionSlots(options: { poolSize?: number; extra?: { max?: number } } | undefined): number {
	const stated = Number(options?.poolSize ?? options?.extra?.max ?? 0);
	const poolSize = Number.isFinite(stated) && stated > 0 ? stated : 10;
	return Math.min(4, Math.floor(poolSize / 2));
}

/**
 * Takes a lock connection slot, waiting for one when all are held; `false` when `deadlineAt` (epoch ms) passes first
 * (the caller then treats the lock as held).
 */
async function takeLockConnection(slots: number, deadlineAt?: number): Promise<boolean> {
	while (LOCK_CONNECTIONS.inUse >= slots) {
		const left = deadlineAt === undefined ? undefined : deadlineAt - Date.now();
		if (left !== undefined && left <= 0) return false;
		await new Promise<void>((resolve) => {
			const wake = () => {
				if (timer) clearTimeout(timer);
				resolve();
			};
			const timer =
				left === undefined
					? null
					: setTimeout(() => {
							const index = LOCK_CONNECTIONS.waiting.indexOf(wake);
							if (index >= 0) LOCK_CONNECTIONS.waiting.splice(index, 1);
							resolve();
						}, left);
			LOCK_CONNECTIONS.waiting.push(wake);
		});
	}
	LOCK_CONNECTIONS.inUse++;
	return true;
}

let smallPoolLogged = false;
const logger = new Logger('TaskAutomationLocks');

function releaseLockConnection(): void {
	LOCK_CONNECTIONS.inUse--;
	LOCK_CONNECTIONS.waiting.shift()?.();
}

/**
 * A named lock held across the processes, taken without waiting: a second holder that finds it held does nothing (the
 * first is doing the work). PostgreSQL: a transaction-scoped advisory lock on a connection of its own; MySQL:
 * `GET_LOCK(…, 0)`; SQLite (one process): a flag in this process. The due sweep holds one; each task's runs hold
 * another (`TaskAutomationTaskLock`). The lock connection comes from the pool the work reads through, so a process
 * holds at most `lockConnectionSlots` of them; a pool that cannot spare two keeps to the flag in this process.
 */
export class TaskAutomationSweepLock {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Runs `work` when the lock is free and answers its result, or `null` when another holder has it — or, with
	 * `deadlineAt` (epoch ms), when no lock connection came free before it.
	 */
	async tryRun<T>(name: string, work: () => Promise<T>, deadlineAt?: number): Promise<T | null> {
		if (HELD_IN_PROCESS.has(name)) return null;
		HELD_IN_PROCESS.add(name);
		try {
			return await this.acrossProcesses(name, work, deadlineAt);
		} finally {
			HELD_IN_PROCESS.delete(name);
		}
	}

	private async acrossProcesses<T>(name: string, work: () => Promise<T>, deadlineAt?: number): Promise<T | null> {
		const type = String(this.dataSource.options.type);
		const postgres = type === 'postgres';
		const mysql = type === 'mysql' || type === 'mariadb';
		const slots = lockConnectionSlots(this.dataSource.options as never);
		if (!postgres && !mysql) return work();
		if (slots < 2) {
			if (!smallPoolLogged) {
				smallPoolLogged = true;
				logger.warn(
					'Task automations: the database pool is too small to spare lock connections (fewer than 4); runs and the ' +
						'due-date sweep are kept one at a time in this process only. Run one API process, or raise DB_POOL_SIZE.'
				);
			}
			return work();
		}
		const key = `gauzy-task-automations:${createHash('sha256').update(name).digest('hex').slice(0, 40)}`;
		if (!(await takeLockConnection(slots, deadlineAt))) return null;
		const runner = this.dataSource.createQueryRunner();
		try {
			await runner.connect();
		} catch (error) {
			releaseLockConnection();
			throw error;
		}
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
				// A named lock lives as long as its session: a session whose release is not confirmed is closed, never
				// handed back to the pool still holding the lock.
				const released = await runner
					.query('SELECT RELEASE_LOCK(?) AS released', [key])
					.then((rows: Array<{ released?: unknown }>) => Number(rows?.[0]?.released) === 1)
					.catch(() => false);
				if (!released) {
					try {
						(runner as unknown as { databaseConnection?: { destroy?: () => void } }).databaseConnection?.destroy?.();
					} catch {
						// The connection is going away either way.
					}
				}
			}
		} finally {
			await runner.release().catch(() => undefined);
			releaseLockConnection();
		}
	}
}
