import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddTimeSlotSessionEntity1757149401754 implements MigrationInterface {
	name = 'AddTimeSlotSessionEntity1757149401754';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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

		switch (queryRunner.connection.options.type) {
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
		await queryRunner.query(
			`CREATE TABLE "time_slot_session" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "sessionId" character varying NOT NULL, "startTime" TIMESTAMP, "lastActivity" TIMESTAMP, "timeSlotId" uuid NOT NULL, "employeeId" uuid NOT NULL, CONSTRAINT "PK_92509d6a10a5b8faff66101e83d" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_63d9e137716eb1bdfe93ccf23d" ON "time_slot_session" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f120aba634b63389a3a351a4f5" ON "time_slot_session" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f955d4fc2146d3696c9af8f068" ON "time_slot_session" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_382c80e92aa263e9cd2e98a664" ON "time_slot_session" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_d79d3bd6115187d2e73ea8b3ff" ON "time_slot_session" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_228e69500a55e2f311c0219d9f" ON "time_slot_session" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_674bdff03d51898ca8a237f163" ON "time_slot_session" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_12a0a79f962a124f93c8796e4b" ON "time_slot_session" ("sessionId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ba7262af6a2906c992fe8ca3fe" ON "time_slot_session" ("startTime") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_aed773ef44611150e65749733b" ON "time_slot_session" ("lastActivity") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8966a6ed4ff080f259844c38b9" ON "time_slot_session" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dc605390f47dd26469f855307d" ON "time_slot_session" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_63d9e137716eb1bdfe93ccf23d2" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_f120aba634b63389a3a351a4f57" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_f955d4fc2146d3696c9af8f0688" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_228e69500a55e2f311c0219d9fc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_674bdff03d51898ca8a237f1630" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_8966a6ed4ff080f259844c38b9d" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_session" ADD CONSTRAINT "FK_dc605390f47dd26469f855307dc" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_dc605390f47dd26469f855307dc"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_8966a6ed4ff080f259844c38b9d"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_674bdff03d51898ca8a237f1630"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_228e69500a55e2f311c0219d9fc"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_f955d4fc2146d3696c9af8f0688"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_f120aba634b63389a3a351a4f57"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" DROP CONSTRAINT "FK_63d9e137716eb1bdfe93ccf23d2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dc605390f47dd26469f855307d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8966a6ed4ff080f259844c38b9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_aed773ef44611150e65749733b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ba7262af6a2906c992fe8ca3fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_12a0a79f962a124f93c8796e4b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_674bdff03d51898ca8a237f163"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_228e69500a55e2f311c0219d9f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d79d3bd6115187d2e73ea8b3ff"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_382c80e92aa263e9cd2e98a664"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f955d4fc2146d3696c9af8f068"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f120aba634b63389a3a351a4f5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_63d9e137716eb1bdfe93ccf23d"`);
		await queryRunner.query(`DROP TABLE "time_slot_session"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "time_slot_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sessionId" varchar NOT NULL, "startTime" datetime, "lastActivity" datetime, "timeSlotId" varchar NOT NULL, "employeeId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_63d9e137716eb1bdfe93ccf23d" ON "time_slot_session" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f120aba634b63389a3a351a4f5" ON "time_slot_session" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f955d4fc2146d3696c9af8f068" ON "time_slot_session" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_382c80e92aa263e9cd2e98a664" ON "time_slot_session" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_d79d3bd6115187d2e73ea8b3ff" ON "time_slot_session" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_228e69500a55e2f311c0219d9f" ON "time_slot_session" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_674bdff03d51898ca8a237f163" ON "time_slot_session" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_12a0a79f962a124f93c8796e4b" ON "time_slot_session" ("sessionId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ba7262af6a2906c992fe8ca3fe" ON "time_slot_session" ("startTime") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_aed773ef44611150e65749733b" ON "time_slot_session" ("lastActivity") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8966a6ed4ff080f259844c38b9" ON "time_slot_session" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dc605390f47dd26469f855307d" ON "time_slot_session" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "time_slot_session"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`time_slot_session\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`sessionId\` varchar(255) NOT NULL, \`startTime\` datetime NULL, \`lastActivity\` datetime NULL, \`timeSlotId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_63d9e137716eb1bdfe93ccf23d\` (\`createdByUserId\`), INDEX \`IDX_f120aba634b63389a3a351a4f5\` (\`updatedByUserId\`), INDEX \`IDX_f955d4fc2146d3696c9af8f068\` (\`deletedByUserId\`), INDEX \`IDX_382c80e92aa263e9cd2e98a664\` (\`isActive\`), INDEX \`IDX_d79d3bd6115187d2e73ea8b3ff\` (\`isArchived\`), INDEX \`IDX_228e69500a55e2f311c0219d9f\` (\`tenantId\`), INDEX \`IDX_674bdff03d51898ca8a237f163\` (\`organizationId\`), INDEX \`IDX_12a0a79f962a124f93c8796e4b\` (\`sessionId\`), INDEX \`IDX_ba7262af6a2906c992fe8ca3fe\` (\`startTime\`), INDEX \`IDX_aed773ef44611150e65749733b\` (\`lastActivity\`), INDEX \`IDX_8966a6ed4ff080f259844c38b9\` (\`timeSlotId\`), INDEX \`IDX_dc605390f47dd26469f855307d\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);

		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_63d9e137716eb1bdfe93ccf23d2\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_f120aba634b63389a3a351a4f57\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_f955d4fc2146d3696c9af8f0688\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_228e69500a55e2f311c0219d9fc\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_674bdff03d51898ca8a237f1630\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_8966a6ed4ff080f259844c38b9d\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` ADD CONSTRAINT \`FK_dc605390f47dd26469f855307dc\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_dc605390f47dd26469f855307dc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_8966a6ed4ff080f259844c38b9d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_674bdff03d51898ca8a237f1630\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_228e69500a55e2f311c0219d9fc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_f955d4fc2146d3696c9af8f0688\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_f120aba634b63389a3a351a4f57\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_session\` DROP FOREIGN KEY \`FK_63d9e137716eb1bdfe93ccf23d2\``
		);

		await queryRunner.query(`DROP INDEX \`IDX_dc605390f47dd26469f855307d\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_8966a6ed4ff080f259844c38b9\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_aed773ef44611150e65749733b\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_ba7262af6a2906c992fe8ca3fe\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_12a0a79f962a124f93c8796e4b\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_674bdff03d51898ca8a237f163\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_228e69500a55e2f311c0219d9f\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_d79d3bd6115187d2e73ea8b3ff\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_382c80e92aa263e9cd2e98a664\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_f955d4fc2146d3696c9af8f068\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_f120aba634b63389a3a351a4f5\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP INDEX \`IDX_63d9e137716eb1bdfe93ccf23d\` ON \`time_slot_session\``);
		await queryRunner.query(`DROP TABLE \`time_slot_session\``);
	}
}
