import { QueryRunner } from 'typeorm';
import { EverConnectMembershipResyncDue1791000019900 } from './migrations/1791000019900-EverConnectMembershipResyncDue';

/**
 * `EverConnectMembershipResyncDue` on MySQL, which has neither transactional DDL nor `ADD COLUMN IF NOT EXISTS`: two
 * API processes booting together must not both find the column missing, so the check and the `ALTER TABLE` run inside
 * one named lock. (The migration on SQLite, and on Postgres and MySQL where the suite reaches them, is run for real by
 * `plugins/ever-connect/src/lib/specs/membership-resync-due-migration.db.spec.ts`.)
 */
describe('EverConnectMembershipResyncDue on MySQL', () => {
	const runner = (options: { hasColumn: boolean; acquired?: number }) => {
		const steps: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'mysql' } },
			isTransactionActive: false,
			hasColumn: async () => {
				steps.push('hasColumn');
				return options.hasColumn;
			},
			query: async (sql: string) => {
				steps.push(sql.replace(/\s+/g, ' ').trim());
				return sql.includes('GET_LOCK') ? [{ acquired: options.acquired ?? 1 }] : [];
			}
		} as unknown as QueryRunner;
		return { steps, queryRunner };
	};

	it('checks for the column and adds it inside one named lock', async () => {
		const { steps, queryRunner } = runner({ hasColumn: false });

		await new EverConnectMembershipResyncDue1791000019900().up(queryRunner);

		expect(steps).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'hasColumn',
			'ALTER TABLE `ever_connect_connection` ADD `membershipResyncDueAt` bigint NULL',
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('changes nothing for the process that gets the lock second, and still releases it', async () => {
		const { steps, queryRunner } = runner({ hasColumn: true });

		await new EverConnectMembershipResyncDue1791000019900().up(queryRunner);

		expect(steps).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'hasColumn', 'SELECT RELEASE_LOCK(?)']);
	});

	it('fails without touching the table when the lock is not granted', async () => {
		const { steps, queryRunner } = runner({ hasColumn: false, acquired: 0 });

		await expect(new EverConnectMembershipResyncDue1791000019900().up(queryRunner)).rejects.toThrow(
			'Could not acquire the MySQL migration lock gauzy:migration:1791000019900.'
		);
		expect(steps).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`']);
	});

	it('names a lock MySQL accepts (64 characters at most)', () => {
		expect(new EverConnectMembershipResyncDue1791000019900().mysqlLockName.length).toBeLessThanOrEqual(64);
	});
});
