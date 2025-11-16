
import * as Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export class QueueStore {
	private db: Database.Database;
	private tableName: string;

	constructor(options: { path: string, tableName?: string }) {
		this.tableName = options.tableName || 'task';
		this.db = new Database(options.path);
		this.db.pragma('journal_mode = WAL');
		this.db.pragma('synchronous = NORMAL');

		this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        lock TEXT,
        task TEXT,
        priority INTEGER,
        added INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_priority_added
        ON ${this.tableName}(lock, priority DESC, added ASC);
    `);
	}

	connect(cb: (err: any, length: number) => void) {
		try {
			const row = this.db
				.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE lock = '' OR lock IS NULL`)
				.get();
			cb(null, row.count);
		} catch (err) {
			cb(err, 0);
		}
	}

	getRunningTasks(cb: (err: any, map: Record<string, string[]>) => void) {
		try {
			const rows = this.db
				.prepare(`SELECT id, lock FROM ${this.tableName} WHERE lock != '' AND lock IS NOT NULL`)
				.all();

			const tasks: Record<string, string[]> = {};
			for (const row of rows) {
				if (!tasks[row.lock]) tasks[row.lock] = [];
				tasks[row.lock].push(row.id);
			}

			cb(null, tasks);
		} catch (err) {
			cb(err, {});
		}
	}

	getTask(taskId: string, cb: (err: any, task?: any) => void) {
		try {
			const row = this.db
				.prepare(`SELECT task FROM ${this.tableName} WHERE id=?`)
				.get(taskId);
			if (!row) return cb(null, undefined);
			cb(null, JSON.parse(row.task));
		} catch (err) {
			cb(err);
		}
	}

	putTask(taskId: string, task: any, priority: number, cb: (err?: any) => void) {
		try {
			console.log('put task to sqlite');
			this.db
				.prepare(
					`INSERT OR REPLACE INTO ${this.tableName} (id, lock, task, priority, added)
					VALUES (@id, '', @task, @priority, @added)`
				)
				.run({
					id: taskId,
					task: JSON.stringify(task),
					priority,
					added: Date.now(),
				});
			cb();
		} catch (err) {
			console.log(err);
			cb(err);
		}
	}

	private lockRows(n: number, orderBy: string): string {
		const lockId = randomUUID();
		const txn = this.db.transaction(() => {
			const result = this.db.prepare(
				`UPDATE ${this.tableName}
				SET lock = @lockId
				WHERE id IN (
					SELECT id FROM ${this.tableName}
					WHERE lock='' OR lock IS NULL
					${orderBy}
					LIMIT @n
				)`
			).run({ lockId, n });
			return result.changes > 0 ? lockId : '';
		});
		return txn();
	}

	takeFirstN(n: number, cb: (err: any, lockId: string) => void) {
		try {
			const lockId = this.lockRows(n, 'ORDER BY priority DESC, added ASC');
			cb(null, lockId);
		} catch (err) {
			cb(err, '');
		}
	}

	takeLastN(n: number, cb: (err: any, lockId: string) => void) {
		try {
			const lockId = this.lockRows(n, 'ORDER BY priority DESC, added DESC');
			cb(null, lockId);
		} catch (err) {
			cb(err, '');
		}
	}

	deleteTask(taskId: string, cb: (err?: any) => void) {
		try {
			this.db.prepare(`DELETE FROM ${this.tableName} WHERE id=?`).run(taskId);
			cb();
		} catch (err) {
			cb(err);
		}
	}

	getLock(lockId: string, cb: (err: any, tasks: { [taskId: string]: any }) => void) {
		try {
			const rows = this.db
				.prepare(`SELECT id, task FROM ${this.tableName} WHERE lock=?`)
				.all(lockId);

			const tasks: { [taskId: string]: any } = {};
			for (const r of rows) {
				tasks[r.id] = JSON.parse(r.task);
			}
			cb(null, tasks);
		} catch (err) {
			cb(err, {});
		}
	}

	releaseLock(lockId: string, cb: (err?: any) => void) {
		try {
			this.db.prepare(`DELETE FROM ${this.tableName} WHERE lock=?`).run(lockId);
			cb();
		} catch (err) {
			cb(err);
		}
	}
}
