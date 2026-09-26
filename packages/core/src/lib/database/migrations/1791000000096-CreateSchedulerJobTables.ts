import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the scheduler's run ledger and its dead-letter store — the two tables that make a scheduled
 * pass observable after the fact.
 *
 * **Why two tables are a kernel concern.** Every scheduled pass in this tree is registered through the
 * same scheduler, and the programme's own passes are registered there beside every plugin's: the
 * measurement audit, the payment-instrument audit, the reservation/cart/payment-session expiry sweeps,
 * the reconciliation passes, the payout run. Before these two tables a pass that failed left nothing
 * an operator could inspect — no run row, no attempt count, no dead letter — so "did it run, and what
 * did it do" was answerable only from log lines that had already rotated away. The scheduler is a
 * platform package and not a plugin, so its tables are kernel tables and live in `packages/core` with
 * the rest of the platform's own model, named for the concern rather than for any one domain.
 *
 * **`job_execution` is the platform's single run ledger.** One row per **attempt** of one scheduled
 * job: which job, which attempt, what caused it, when it started and finished, how it ended, on which
 * instance, and what it said when it broke. One ledger rather than one per job family, because the
 * question an operator asks is the same question whatever the job does. `jobName` is denormalised so a
 * row stays readable after the job is renamed or removed from the registry.
 *
 * **`job_dead_letter` is the platform's only dead-letter form.** There is no per-queue `<name>-dead`
 * queue beside it: a job that exhausts its attempts is a platform-level fact whatever queue it came
 * from, and it has to stay inspectable and replayable by an operator rather than expiring with the
 * queue's own failed set. The payload is stored verbatim, so a replay re-enqueues exactly what failed.
 *
 * **The invariants the DDL carries, and the ones it deliberately does not.**
 *
 * - `finishedAt` is non-null exactly when `status <> 'RUNNING'`, and `SKIPPED_OVERLAP` is a **row, not
 *   silence**: a tick that could not start because another instance holds the job's lock is recorded,
 *   because "the job did not run" and "the job ran and did nothing" are different facts. Both are
 *   enforced by `JobExecutionService` rather than by a `CHECK`, because the same rule has to hold on a
 *   row written through either ORM and a check constraint would have to be recreated on three
 *   dialects.
 * - One live run per job and scope is likewise a service rule: the two partial indexes below are
 *   probes, not uniqueness rules. A partial *unique* index on `("jobId","status") WHERE status =
 *   'RUNNING'` would be the database form, but §3.21 does not declare it, and a constraint the schema
 *   does not name is a constraint a later revision silently contradicts.
 * - A dead letter is **never deleted automatically** — only an operator discards it, and a discard is
 *   a status change with a reason. That is why this table gets no retention path while
 *   `job_execution` does: a ledger row is a measurement past its window, a dead letter is an
 *   unhandled failure.
 *
 * **The tick.** `1791000000096` is this set's place in the kernel migration order: it sits after the
 * search tables at `1791000000080` and does not collide with the channel/region set at
 * `1791000000085`, the address book at `1791000000092` or the contact set at `1791000000094`, all of
 * which are being written in the same working tree. Nothing references either table yet, so the tick
 * carries no dependency of its own; it is fixed here so the file cannot be renumbered under a
 * migration that has already run in somebody's database.
 *
 * **Every statement is guarded by `hasTable`.** The guard is not decoration: a migration is a file an
 * installation may already have applied out of band — a development database synchronised from the
 * entities has both tables and none of this migration's history — and a second run must therefore add
 * nothing rather than fail on the first `CREATE TABLE`.
 *
 * **MySQL has no filtered index**, so the one uniqueness rule of this set — one dead letter per job
 * per queue, `UQ_job_dead_letter_job` — takes the documented generated-column fallback: a stored
 * `deletedKey` that is `'0'` while the row is live and the row's own id once it is deleted is
 * appended to the tuple, so live rows collide and soft-deleted rows never do. Its other guard,
 * `"jobId" IS NOT NULL`, needs no help on any dialect: all three treat `NULL` values as distinct in a
 * unique index, so a row without a job id never collides. The two remaining indexes are lookup
 * narrowings rather than uniqueness rules, so MySQL gets them without their predicate.
 */
export class CreateSchedulerJobTables1791000000096 implements MigrationInterface {
	name = 'CreateSchedulerJobTables1791000000096';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('job_execution'))) {
			await queryRunner.query(
				`CREATE TABLE "job_execution" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "jobId" character varying(128) NOT NULL, "jobName" character varying(128) NOT NULL, "trigger" character varying(16) NOT NULL DEFAULT 'SCHEDULED', "status" character varying(16) NOT NULL DEFAULT 'RUNNING', "attemptCount" integer NOT NULL DEFAULT 1, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "finishedAt" TIMESTAMP, "durationMs" integer, "nodeId" character varying(128), "lastError" text, "metadata" jsonb, CONSTRAINT "PK_job_execution_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_created_by_user" ON "job_execution" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_updated_by_user" ON "job_execution" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_deleted_by_user" ON "job_execution" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_is_active" ON "job_execution" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_is_archived" ON "job_execution" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_tenant" ON "job_execution" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_organization" ON "job_execution" ("organizationId")`);
			// A job's recent runs, newest first: the read behind "did it run, and what did it do". It
			// deliberately does not lead with the tenancy column, because the ledger's own readers are
			// global passes — a retention sweep, a health surface, an operator looking at one job across
			// every scope it ran for — and leading with the tenant would make it unusable for them.
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_job" ON "job_execution" ("jobId", "startedAt") WHERE "deletedAt" IS NULL`
			);
			// What is running right now. The predicate is the index: only rows that are still open are
			// indexed, so the probe stays small however long the ledger grows.
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_state" ON "job_execution" ("status", "startedAt") WHERE "status" = 'RUNNING'`
			);
		}

		if (!(await queryRunner.hasTable('job_dead_letter'))) {
			// The operator reference releases rather than cascades: the row is the record that a job
			// failed and that somebody acted on it, and removing the actor's account must not erase the
			// fact. It is created inline, guarded by the presence of the table it names, exactly as the
			// other kernel sets guard a reference into a table they do not create.
			const actor = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT "FK_job_dead_letter_replayed_by" FOREIGN KEY ("replayedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "job_dead_letter" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "queueName" character varying(128) NOT NULL, "jobId" character varying(128), "jobName" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'NEW', "attemptCount" integer NOT NULL, "failedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastError" text, "replayedAt" TIMESTAMP, "replayedByUserId" uuid, "discardedAt" TIMESTAMP, "discardedReason" character varying(255), "metadata" jsonb${actor}, CONSTRAINT "PK_job_dead_letter_id" PRIMARY KEY ("id"))`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_created_by_user" ON "job_dead_letter" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_updated_by_user" ON "job_dead_letter" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_deleted_by_user" ON "job_dead_letter" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_is_active" ON "job_dead_letter" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_is_archived" ON "job_dead_letter" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_tenant" ON "job_dead_letter" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_organization" ON "job_dead_letter" ("organizationId")`
			);
			// One dead letter per job per queue while the row is live, so the retry of a failed write
			// cannot record the same failure twice. A job that failed before its queue issued an id
			// carries none, and `NULL` values are distinct in a unique index on every dialect, which is
			// why such a row never collides.
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_job_dead_letter_job" ON "job_dead_letter" ("queueName", "jobId") WHERE "jobId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			// The operator's queue, oldest failure first, and the `deadLetterDepth` count of the rows an
			// operator has not yet acted on. Not tenant-led for the same reason as the ledger's job index:
			// the queue listing groups by queue, and the platform's queue surface is not per organization.
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_status" ON "job_dead_letter" ("status", "failedAt") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// The dead-letter store first: it is the dependent half of the pair, and dropping in this order
		// is what keeps the reversal applicable on an installation that later adds a reference to the
		// ledger from it.
		await queryRunner.query(`DROP TABLE IF EXISTS "job_dead_letter"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "job_execution"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite supports a filtered index, so every predicate the schema states is created as written,
	 * and it cannot add a foreign key to an existing table, which is why the one reference of this set
	 * is declared inline here, guarded by the presence of the table it names.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('job_execution'))) {
			await queryRunner.query(
				`CREATE TABLE "job_execution" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "jobId" varchar(128) NOT NULL, "jobName" varchar(128) NOT NULL, "trigger" varchar(16) NOT NULL DEFAULT ('SCHEDULED'), "status" varchar(16) NOT NULL DEFAULT ('RUNNING'), "attemptCount" integer NOT NULL DEFAULT (1), "startedAt" datetime NOT NULL DEFAULT (datetime('now')), "finishedAt" datetime, "durationMs" integer, "nodeId" varchar(128), "lastError" text, "metadata" text)`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_created_by_user" ON "job_execution" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_updated_by_user" ON "job_execution" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_deleted_by_user" ON "job_execution" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_is_active" ON "job_execution" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_is_archived" ON "job_execution" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_tenant" ON "job_execution" ("tenantId")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_execution_organization" ON "job_execution" ("organizationId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_job" ON "job_execution" ("jobId", "startedAt") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_execution_state" ON "job_execution" ("status", "startedAt") WHERE "status" = 'RUNNING'`
			);
		}

		if (!(await queryRunner.hasTable('job_dead_letter'))) {
			const actor = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT "FK_job_dead_letter_replayed_by" FOREIGN KEY ("replayedByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE "job_dead_letter" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "queueName" varchar(128) NOT NULL, "jobId" varchar(128), "jobName" varchar(128) NOT NULL, "payload" text NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('NEW'), "attemptCount" integer NOT NULL, "failedAt" datetime NOT NULL DEFAULT (datetime('now')), "lastError" text, "replayedAt" datetime, "replayedByUserId" varchar, "discardedAt" datetime, "discardedReason" varchar(255), "metadata" text${actor})`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_created_by_user" ON "job_dead_letter" ("createdByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_updated_by_user" ON "job_dead_letter" ("updatedByUserId")`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_deleted_by_user" ON "job_dead_letter" ("deletedByUserId")`
			);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_is_active" ON "job_dead_letter" ("isActive")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_is_archived" ON "job_dead_letter" ("isArchived")`);
			await queryRunner.query(`CREATE INDEX "IDX_job_dead_letter_tenant" ON "job_dead_letter" ("tenantId")`);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_organization" ON "job_dead_letter" ("organizationId")`
			);
			await queryRunner.query(
				`CREATE UNIQUE INDEX "UQ_job_dead_letter_job" ON "job_dead_letter" ("queueName", "jobId") WHERE "jobId" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(
				`CREATE INDEX "IDX_job_dead_letter_status" ON "job_dead_letter" ("status", "failedAt") WHERE "deletedAt" IS NULL`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "job_dead_letter"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "job_execution"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the fallback of the conventions chapter is used for the one
	 * uniqueness rule of this set: a **stored generated key column** `deletedKey` is `'0'` while the row
	 * is live and the row's own id once it is deleted, and it is appended to the tuple. Live rows then
	 * collide on the key and soft-deleted rows never do, which is what the other two dialects get from
	 * `WHERE "deletedAt" IS NULL`. The rule's second guard, `"jobId" IS NOT NULL`, is honoured by the
	 * dialect itself: `NULL` values are distinct in a unique index, so a row without a job id never
	 * collides.
	 *
	 * The other two indexes are lookup narrowings rather than uniqueness rules, so this dialect gets
	 * them without their predicate — a partial index has no MySQL form that would not add a column the
	 * entities do not need.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable('job_execution'))) {
			await queryRunner.query(
				`CREATE TABLE \`job_execution\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`jobId\` varchar(128) NOT NULL, \`jobName\` varchar(128) NOT NULL, \`trigger\` varchar(16) NOT NULL DEFAULT 'SCHEDULED', \`status\` varchar(16) NOT NULL DEFAULT 'RUNNING', \`attemptCount\` int NOT NULL DEFAULT 1, \`startedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`finishedAt\` datetime NULL, \`durationMs\` int NULL, \`nodeId\` varchar(128) NULL, \`lastError\` text NULL, \`metadata\` json NULL, INDEX \`IDX_job_execution_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_job_execution_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_job_execution_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_job_execution_is_active\` (\`isActive\`), INDEX \`IDX_job_execution_is_archived\` (\`isArchived\`), INDEX \`IDX_job_execution_tenant\` (\`tenantId\`), INDEX \`IDX_job_execution_organization\` (\`organizationId\`), INDEX \`IDX_job_execution_job\` (\`jobId\`, \`startedAt\`), INDEX \`IDX_job_execution_state\` (\`status\`, \`startedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}

		if (!(await queryRunner.hasTable('job_dead_letter'))) {
			const actor = (await queryRunner.hasTable('user'))
				? ', CONSTRAINT `FK_job_dead_letter_replayed_by` FOREIGN KEY (`replayedByUserId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
				: '';

			await queryRunner.query(
				`CREATE TABLE \`job_dead_letter\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`queueName\` varchar(128) NOT NULL, \`jobId\` varchar(128) NULL, \`jobName\` varchar(128) NOT NULL, \`payload\` json NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'NEW', \`attemptCount\` int NOT NULL, \`failedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`lastError\` text NULL, \`replayedAt\` datetime NULL, \`replayedByUserId\` varchar(36) NULL, \`discardedAt\` datetime NULL, \`discardedReason\` varchar(255) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_job_dead_letter_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_job_dead_letter_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_job_dead_letter_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_job_dead_letter_is_active\` (\`isActive\`), INDEX \`IDX_job_dead_letter_is_archived\` (\`isArchived\`), INDEX \`IDX_job_dead_letter_tenant\` (\`tenantId\`), INDEX \`IDX_job_dead_letter_organization\` (\`organizationId\`), INDEX \`IDX_job_dead_letter_status\` (\`status\`, \`failedAt\`)${actor}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
			// MySQL has no partial indexes: the one dead letter per job per queue is the tuple the other
			// dialects guard with a predicate, plus the generated delete key that makes a soft-deleted row
			// stop occupying it.
			await queryRunner.query(
				`CREATE UNIQUE INDEX \`UQ_job_dead_letter_job\` ON \`job_dead_letter\` (\`queueName\`, \`jobId\`, \`deletedKey\`)`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`job_dead_letter\``);
		await queryRunner.query(`DROP TABLE IF EXISTS \`job_execution\``);
	}
}
