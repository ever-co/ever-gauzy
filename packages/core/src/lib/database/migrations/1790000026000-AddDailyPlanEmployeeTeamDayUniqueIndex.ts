import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

type Dialect = 'postgres' | 'mysql' | 'sqlite';

/** The name the `DailyPlan` entity refers to. */
const INDEX_NAME = 'IDX_daily_plan_employee_team_day_unique';

/**
 * The day of `daily_plan.date`, as each dialect writes it in an index expression. It is the date part of
 * the stored value, which is the day `DailyPlanService` looks a plan up by (`date >= day AND date < day + 1`).
 */
const PLAN_DAY: Record<Dialect, string> = {
	postgres: `"date"::date`,
	mysql: `CAST("date" AS DATE)`,
	sqlite: `date("date")`
};

/**
 * The team of a plan. A NULL would be distinct from every other one, so the plans without a team are
 * given a key of their own, which makes them one group.
 */
const PLAN_TEAM = `COALESCE("organizationTeamId", '00000000-0000-0000-0000-000000000000')`;

/**
 * The key of the unique index. MySQL keeps the ids in varchar(255) columns, and four of them exceed the
 * 3072 bytes of an InnoDB key: there each id is indexed on its first 36 characters, a whole uuid.
 */
const UNIQUE_KEY: Record<Dialect, string> = {
	postgres: `"tenantId", "organizationId", "employeeId", (${PLAN_TEAM}), (${PLAN_DAY.postgres})`,
	mysql: `"tenantId"(36), "organizationId"(36), "employeeId"(36), (CAST(${PLAN_TEAM} AS CHAR(36))), (${PLAN_DAY.mysql})`,
	sqlite: `"tenantId", "organizationId", "employeeId", (${PLAN_TEAM}), (${PLAN_DAY.sqlite})`
};

/** Rows per statement, so no statement binds more than the 999 parameters older SQLite builds accept. */
const BATCH_SIZE = 400;

/**
 * One daily plan per employee, team and UTC day.
 *
 * `POST /daily-plan` adds the task to the employee's plan for that day in that team when there is one,
 * but it looked that plan up in a separate query, so two concurrent requests could both create a plan.
 * It also compared `organizationTeamId = NULL` when no team was sent, which matches nothing, so each such
 * request created another plan.
 *
 * Existing duplicates are merged first. Plans with the same tenant, organization, employee, team and UTC
 * day form a group, plans without a team forming their own group, and the plan kept is a live one before
 * a soft-deleted one, then the one with the most tasks, then the oldest. It receives the task links of the
 * others that it does not already have, and the largest `workTimePlanned` of the group; the others are then
 * deleted. Plans of two different teams are never merged. Plans without a tenant, an organization or an
 * employee are left alone: the index treats NULLs in those columns as distinct, so they cannot break it.
 *
 * Then a unique index on (tenantId, organizationId, employeeId, team, day of `date`) is built. The stored
 * dates are not rewritten. MySQL needs 8.0.13 or later for the functional key parts.
 *
 * `down()` drops the index only. The merge cannot be undone: the deleted plans are gone, and their tasks
 * stay on the plan that was kept.
 */
export class AddDailyPlanEmployeeTeamDayUniqueIndex1790000026000 implements MigrationInterface {
	name = 'AddDailyPlanEmployeeTeamDayUniqueIndex1790000026000';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		const dialect = this.dialect(queryRunner);

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			// Writers wait until the index is built: a task link added to a plan the merge deletes would be
			// lost, and a duplicate created meanwhile would fail the build. Reads go on. Give up after 5 s
			// rather than queue every writer behind a long transaction; the next start runs this again.
			await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
			await queryRunner.query(`LOCK TABLE "daily_plan", "daily_plan_task" IN SHARE ROW EXCLUSIVE MODE`);
		}
		if (dialect === 'mysql' && queryRunner.isTransactionActive) {
			// LOCK TABLES would end the migration's transaction, so the plan rows are locked instead, until
			// CREATE INDEX commits the merge. Linking a task to a plan takes a shared lock on that plan for the
			// foreign key check, so such a write waits, then fails on a plan the merge deleted instead of being
			// lost. A duplicate plan created meanwhile fails the build, and the next start merges again.
			await queryRunner.query('SELECT COUNT(*) FROM `daily_plan` FOR UPDATE');
		}

		await this.mergeDuplicatePlans(queryRunner, dialect);
		await queryRunner.query(
			this.sql(dialect, `CREATE UNIQUE INDEX "${INDEX_NAME}" ON "daily_plan" (${UNIQUE_KEY[dialect]})`)
		);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
		const dialect = this.dialect(queryRunner);

		await queryRunner.query(
			dialect === 'mysql'
				? `DROP INDEX \`${INDEX_NAME}\` ON \`daily_plan\``
				: `DROP INDEX IF EXISTS "${INDEX_NAME}"`
		);
	}

	/**
	 * Merges every group of plans sharing a tenant, an organization, an employee, a team and a UTC day
	 * into the plan kept for it, as described on the class.
	 *
	 * @param queryRunner
	 * @param dialect
	 */
	private async mergeDuplicatePlans(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const group = `PARTITION BY "tenantId", "organizationId", "employeeId", "team", "day"`;
		const plans: Array<{
			id: string;
			keptId: string;
			workTimePlanned: string | number;
			groupWorkTimePlanned: string | number;
		}> = await queryRunner.query(
			this.sql(
				dialect,
				`SELECT "id", "keptId", "workTimePlanned", "groupWorkTimePlanned" FROM (
					SELECT "id", "workTimePlanned",
						FIRST_VALUE("id") OVER (${group} ORDER BY "isDeleted", "taskCount" DESC, "createdAt", "id") AS "keptId",
						MAX("workTimePlanned") OVER (${group}) AS "groupWorkTimePlanned",
						COUNT(*) OVER (${group}) AS "groupSize"
					FROM (
						SELECT p."id", p."tenantId", p."organizationId", p."employeeId", p."createdAt", p."workTimePlanned",
							CASE WHEN p."deletedAt" IS NULL THEN 0 ELSE 1 END AS "isDeleted",
							${PLAN_TEAM} AS "team", ${PLAN_DAY[dialect]} AS "day", COALESCE(t."taskCount", 0) AS "taskCount"
						FROM "daily_plan" p
						LEFT JOIN (
							SELECT "dailyPlanId", COUNT(*) AS "taskCount" FROM "daily_plan_task" GROUP BY "dailyPlanId"
						) t ON t."dailyPlanId" = p."id"
						WHERE p."tenantId" IS NOT NULL AND p."organizationId" IS NOT NULL AND p."employeeId" IS NOT NULL
					) "plan"
				) "ranked"
				WHERE "groupSize" > 1`
			)
		);

		const removed = plans.filter(({ id, keptId }) => id !== keptId);
		if (!removed.length) {
			return;
		}

		// The links of every plan in a group, so that the kept plan's own links are known too.
		const links: Array<{ dailyPlanId: string; taskId: string }> = [];
		for (const ids of this.batches(plans.map(({ id }) => id))) {
			links.push(
				...(await queryRunner.query(
					this.sql(
						dialect,
						`SELECT "dailyPlanId", "taskId" FROM "daily_plan_task" WHERE "dailyPlanId" IN (${this.params(dialect, ids.length)})`
					),
					ids
				))
			);
		}

		const keptIdOf = new Map(removed.map(({ id, keptId }) => [id, keptId]));
		const linked = new Set(links.map(({ dailyPlanId, taskId }) => `${dailyPlanId}/${taskId}`));
		const moved: Array<[string, string]> = [];
		for (const { dailyPlanId, taskId } of links) {
			const keptId = keptIdOf.get(dailyPlanId);
			if (keptId && !linked.has(`${keptId}/${taskId}`)) {
				linked.add(`${keptId}/${taskId}`);
				moved.push([keptId, taskId]);
			}
		}

		for (const pairs of this.batches(moved)) {
			const values = pairs.map((_, index) => `(${this.params(dialect, 2, index * 2)})`).join(', ');
			await queryRunner.query(
				this.sql(dialect, `INSERT INTO "daily_plan_task" ("dailyPlanId", "taskId") VALUES ${values}`),
				pairs.flat()
			);
		}

		for (const { id, keptId, workTimePlanned, groupWorkTimePlanned } of plans) {
			if (id === keptId && Number(groupWorkTimePlanned) > Number(workTimePlanned)) {
				await queryRunner.query(
					this.sql(
						dialect,
						`UPDATE "daily_plan" SET "workTimePlanned" = ${this.params(dialect, 1)} WHERE "id" = ${this.params(dialect, 1, 1)}`
					),
					[groupWorkTimePlanned, id]
				);
			}
		}

		// Explicitly, not through the foreign key: TypeORM turns SQLite's foreign keys off while migrating.
		for (const ids of this.batches(removed.map(({ id }) => id))) {
			const list = this.params(dialect, ids.length);
			await queryRunner.query(
				this.sql(dialect, `DELETE FROM "daily_plan_task" WHERE "dailyPlanId" IN (${list})`),
				ids
			);
			await queryRunner.query(this.sql(dialect, `DELETE FROM "daily_plan" WHERE "id" IN (${list})`), ids);
		}

		console.log(
			chalk.magenta(
				`${this.name}: merged ${removed.length} duplicate daily plan(s) into the plan kept for their team and day`
			)
		);
	}

	/** The connection's dialect, refusing the ones this migration has no SQL for. */
	private dialect(queryRunner: QueryRunner): Dialect {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				return 'postgres';
			case DatabaseTypeEnum.mysql:
				return 'mysql';
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return 'sqlite';
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/** Writes identifiers with MySQL's backticks instead of double quotes. */
	private sql(dialect: Dialect, text: string): string {
		return dialect === 'mysql' ? text.replace(/"/g, '`') : text;
	}

	/** `count` bind placeholders starting after `offset`: `$n` on Postgres, `?` elsewhere. */
	private params(dialect: Dialect, count: number, offset = 0): string {
		return Array.from({ length: count }, (_, index) =>
			dialect === 'postgres' ? `$${offset + index + 1}` : '?'
		).join(', ');
	}

	/** Splits `items` into slices of `BATCH_SIZE`. */
	private batches<T>(items: T[]): T[][] {
		const batches: T[][] = [];
		for (let start = 0; start < items.length; start += BATCH_SIZE) {
			batches.push(items.slice(start, start + BATCH_SIZE));
		}
		return batches;
	}
}
