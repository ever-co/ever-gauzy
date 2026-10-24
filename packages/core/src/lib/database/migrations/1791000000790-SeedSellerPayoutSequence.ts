import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The series this migration seeds: the marketplace's seller payout numbering (`SP-000001`). */
export const SELLER_PAYOUT_SERIES = { key: 'SELLER_PAYOUT', prefix: 'SP-' } as const;

/** The padding a series gets when the organization has no default channel to take it from (`1791000000520`'s). */
const DEFAULT_PADDING = 6;

/**
 * Seeds the `SELLER_PAYOUT` numbering series for every organization (Q7-W3).
 *
 * `SellerPayoutService` numbers each payout from `SequenceService.allocate('SELLER_PAYOUT')`, and no path ever
 * created that series: `1791000000520-SeedCoreDefaults` seeds seven series (ORDER, RETURN, CLAIM, EXCHANGE,
 * PO, SUBSCRIPTION, ENTITLEMENT) and the runtime seed (`createDefaultCommerceDefaults`) the same seven. So the
 * first payout of every organization failed with 404 "No numbering series is configured for SELLER_PAYOUT".
 *
 * This writes, for every live organization, exactly the row `createDefaultCommerceDefaults` now writes for an
 * organization created after it: one organization-wide (`channelId` null) series, prefix `SP-`, the padding of
 * the organization's default channel (else 6), starting at 1, step 1, never reset. The statement is
 * `1791000000520`'s own, so `commerce-defaults.seed.spec.ts` can compare an upgraded organization with a new one.
 *
 * Guarded twice, as `1791000000520` is: by **row** (`NOT EXISTS` on `(organizationId, key, channelId IS NULL)`,
 * the unique index `UQ_sequence_org_key_no_channel` it mirrors), so a re-run or an operator's own `SELLER_PAYOUT`
 * series is never doubled or overwritten; and by **schema**, so an installation without the `sequence` or
 * `organization` columns this reads skips the step with one line instead of failing to boot. A transaction-scoped
 * advisory lock (Postgres) or a named lock (MySQL) makes two processes booting together run it one after the other.
 *
 * `down` removes only the rows nobody has used or changed: the organization-wide `SELLER_PAYOUT` series still
 * exactly as seeded (prefix `SP-`, the seeded padding, `nextValue` 1, step 1, never reset, active, no description)
 * and never written since (`createdAt` = `updatedAt`). A series that has numbered a payout, or that an operator
 * changed, is left in place — deleting it would restart numbering, and a rollback that
 * destroys an operator's data is worse than one that leaves a seed row behind.
 */
export class SeedSellerPayoutSequence1791000000790 implements MigrationInterface {
	name = 'SeedSellerPayoutSequence1791000000790';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000000790;

	/** The MySQL named lock of this migration (MySQL refuses names over 64 characters). */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);

		await this.locked(queryRunner, dialect, () => this.seed(queryRunner, dialect));
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);

		// Every column the "untouched" test reads must be there; without one, nothing is provably untouched and
		// every row is kept.
		const missing = await this.missingSchema(queryRunner, 'sequence', [
			'key',
			'channelId',
			'prefix',
			'padding',
			'nextValue',
			'step',
			'resetPolicy',
			'lastResetAt',
			'isActive',
			'description',
			'createdAt',
			'updatedAt'
		]);
		if (missing.length > 0) {
			this.skip('down', missing);
			return;
		}

		// The padding the seed wrote: the default channel's, else 6. A series with any other width was edited.
		const paddingGuard = (await queryRunner.hasTable('channel'))
			? `AND ("padding" = $6 OR "padding" IN (
					SELECT "c"."orderNumberPadding" FROM "channel" "c"
					WHERE "c"."organizationId" = "sequence"."organizationId"
					  AND "c"."isDefault" = ${this.booleanLiteral(dialect, true)}
					  AND "c"."deletedAt" IS NULL
				 ))`
			: `AND "padding" = $6`;

		await this.locked(queryRunner, dialect, async () => {
			// Untouched = exactly as seeded and never written since (`createdAt` = `updatedAt`: an allocation, an
			// operator's edit or a reset through the service moves `updatedAt`); a deactivated, described, re-padded
			// or used series is an operator's and stays.
			await this.run(
				queryRunner,
				dialect,
				`DELETE FROM "sequence"
				 WHERE "key" = $1
				   AND "channelId" IS NULL
				   AND "prefix" = $2
				   AND "nextValue" = $3
				   AND "step" = $4
				   AND "resetPolicy" = $5
				   AND "lastResetAt" IS NULL
				   AND "deletedAt" IS NULL
				   AND "isActive" = ${this.booleanLiteral(dialect, true)}
				   AND "description" IS NULL
				   AND "createdAt" = "updatedAt"
				   ${paddingGuard}`,
				[SELLER_PAYOUT_SERIES.key, SELLER_PAYOUT_SERIES.prefix, 1, 1, 'NEVER', DEFAULT_PADDING]
			);
		});
	}

	/**
	 * One organization-wide `SELLER_PAYOUT` series per live organization that has none.
	 *
	 * @param queryRunner
	 * @param dialect
	 */
	private async seed(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const organizationMissing = await this.missingSchema(queryRunner, 'organization', ['tenantId']);
		if (organizationMissing.length > 0) {
			this.skip('the seller payout series', organizationMissing);
			return;
		}

		const sequenceMissing = await this.missingSchema(queryRunner, 'sequence', [
			'tenantId',
			'organizationId',
			'key',
			'prefix',
			'padding',
			'nextValue',
			'step',
			'resetPolicy',
			'channelId'
		]);
		if (sequenceMissing.length > 0) {
			this.skip('the seller payout series', sequenceMissing);
			return;
		}

		const organizations: Array<{ id: string }> =
			(await this.run(
				queryRunner,
				dialect,
				`SELECT "id" FROM "organization" WHERE "deletedAt" IS NULL ORDER BY "id" ASC`
			)) ?? [];

		const channelTableExists = await queryRunner.hasTable('channel');

		for (const organization of organizations) {
			let padding = DEFAULT_PADDING;

			if (channelTableExists) {
				const channel: Array<{ orderNumberPadding: number | null }> =
					(await this.run(
						queryRunner,
						dialect,
						`SELECT "orderNumberPadding" FROM "channel"
						 WHERE "organizationId" = $1 AND "isDefault" = ${this.booleanLiteral(dialect, true)} AND "deletedAt" IS NULL
						 ORDER BY "id" ASC`,
						[organization.id]
					)) ?? [];
				if (channel[0]?.orderNumberPadding != null) {
					padding = Number(channel[0].orderNumberPadding);
				}
			}

			await this.run(
				queryRunner,
				dialect,
				`INSERT INTO "sequence" ("id", "tenantId", "organizationId", "key", "prefix", "padding", "nextValue", "step", "resetPolicy")
				 SELECT $1, "organization"."tenantId", "organization"."id", $2, $3, $4, $5, $6, $7
				 FROM "organization"
				 WHERE "organization"."id" = $8
				   AND "organization"."deletedAt" IS NULL
				   AND NOT EXISTS (
					SELECT 1 FROM "sequence" "s"
					WHERE "s"."organizationId" = "organization"."id"
					  AND "s"."key" = $9
					  AND "s"."channelId" IS NULL
					  AND "s"."deletedAt" IS NULL
				   )`,
				[
					uuidv4(),
					SELLER_PAYOUT_SERIES.key,
					SELLER_PAYOUT_SERIES.prefix,
					padding,
					1,
					1,
					'NEVER',
					organization.id,
					SELLER_PAYOUT_SERIES.key
				]
			);
		}
	}

	/**
	 * Runs `work` under this migration's lock: a transaction-scoped advisory lock on Postgres (released with the
	 * migration's transaction), a session-level named lock on MySQL (released in `finally`), none on SQLite (one
	 * writer).
	 */
	private async locked(queryRunner: QueryRunner, dialect: Dialect, work: () => Promise<void>): Promise<void> {
		if (dialect === 'postgres') {
			if (queryRunner.isTransactionActive) {
				await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
			}
			await work();
			return;
		}

		if (dialect === 'mysql') {
			const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [this.mysqlLockName]);
			if (Number(row?.acquired) !== 1) {
				throw new Error(`Could not acquire the MySQL migration lock ${this.mysqlLockName}.`);
			}
			try {
				await work();
			} finally {
				await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [this.mysqlLockName]);
			}
			return;
		}

		await work();
	}

	/** The tables and columns the step needs and the schema does not have. */
	private async missingSchema(queryRunner: QueryRunner, table: string, columns: string[]): Promise<string[]> {
		if (!(await queryRunner.hasTable(table))) {
			return [`${table} (table)`];
		}

		const missing: string[] = [];
		for (const column of columns) {
			if (!(await queryRunner.hasColumn(table, column))) {
				missing.push(`${table}.${column}`);
			}
		}
		return missing;
	}

	/** Logs a step the schema cannot support yet, rather than stopping the API booting. */
	private skip(step: string, missing: string[]): void {
		console.log(
			chalk.gray(`${this.name}: skipping ${step} — not present in this schema yet: ${missing.join(', ')}.`)
		);
	}

	/** A boolean as the dialect's own literal (a constant of this file, never caller input). */
	private booleanLiteral(dialect: Dialect, value: boolean): string {
		if (dialect === 'postgres') {
			return value ? 'true' : 'false';
		}
		return value ? '1' : '0';
	}

	/**
	 * Runs one statement written once with double-quoted identifiers and `$n` placeholders (each used once, in
	 * order): backticks on MySQL, `?` placeholders on MySQL and SQLite.
	 */
	private async run(
		queryRunner: QueryRunner,
		dialect: Dialect,
		sql: string,
		parameters: unknown[] = []
	): Promise<any> {
		let query = sql;
		if (dialect === 'mysql') {
			query = query.replace(/"/g, '`');
		}
		if (dialect !== 'postgres') {
			query = query.replace(/\$\d+/g, '?');
		}
		return await queryRunner.query(query, parameters);
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				return 'postgres';
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return 'sqlite';
			case DatabaseTypeEnum.mysql:
				return 'mysql';
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}
