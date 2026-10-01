import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the four tables of the Ever ID sign-in plugin (`@gauzy/plugin-auth-zitadel`):
 *
 * - `zitadel_account`: links between an Ever ID (`issuer` + `subject`) and Gauzy users;
 * - `zitadel_organization`: links between Gauzy organizations and Ever Platform organizations;
 * - `zitadel_session`: Gauzy sessions opened through Ever ID, for back-channel logout;
 * - `zitadel_logout_jti`: replay cache of back-channel logout tokens.
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's
 * `MIGRATIONS.md` lists it so it can move with the plugin later. The tables exist whether or not the
 * plugin is enabled; they stay empty until it is.
 *
 * Safe to run on a live database: it only creates new, empty tables and their indexes. It reads and
 * changes no existing table and runs no statement per tenant or per row. Every statement is
 * `IF NOT EXISTS`, so running `up` twice is harmless. On Postgres a transaction-scoped advisory lock
 * makes two API processes that boot at the same time against one database (two replicas, or two
 * deployments sharing it) run it one after the other; the second finds everything in place. MySQL
 * creates each table and its indexes in one atomic `CREATE TABLE IF NOT EXISTS`.
 *
 * `down` drops the four tables (and with them their indexes and constraints). No existing data is
 * affected.
 */
export class AuthZitadel1790000018000 implements MigrationInterface {
	name = 'AuthZitadel1790000018000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000018000;

	/** The tables, in the order `down` drops them. */
	private readonly tables = ['zitadel_logout_jti', 'zitadel_session', 'zitadel_organization', 'zitadel_account'];

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
			case DatabaseTypeEnum.postgres:
				for (const table of this.tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const table of this.tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
				}
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
		if (queryRunner.isTransactionActive) {
			// Short waits only: the foreign keys briefly lock "user", "tenant" and "organization", and a second
			// booting process waits here for the first. A timeout fails this boot; the next one retries.
			await queryRunner.query(`SET LOCAL lock_timeout = '10s'`);
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_account" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "issuer" character varying NOT NULL, "subject" character varying NOT NULL, "userId" uuid NOT NULL, "everPersonId" character varying, "emailAtLink" character varying, "linkMethod" character varying NOT NULL, "linkedAt" TIMESTAMP NOT NULL, "lastLoginAt" TIMESTAMP, CONSTRAINT "PK_399a4f42a3d5aa557e53e7b984d" PRIMARY KEY ("id"), CONSTRAINT "FK_88cedc817dd807dfeed2b2dfabc" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f5420dde3595894663e952322c9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a9b456f976ccbf1e872cb8e38ae" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1977be8b0313e1367373dd5912e" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_84de5d3edd29690f1d28a59f91e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_88cedc817dd807dfeed2b2dfab" ON "zitadel_account" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f5420dde3595894663e952322c" ON "zitadel_account" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a9b456f976ccbf1e872cb8e38a" ON "zitadel_account" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6c507920191063266d93977e88" ON "zitadel_account" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0bdf9bc760d5dd511309879934" ON "zitadel_account" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1977be8b0313e1367373dd5912" ON "zitadel_account" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_84de5d3edd29690f1d28a59f91" ON "zitadel_account" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_account_issuer_subject_user" ON "zitadel_account" ("issuer", "subject", "userId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_account_issuer_subject" ON "zitadel_account" ("issuer", "subject")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_organization" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "everOrgId" character varying NOT NULL, "everTenantId" character varying NOT NULL, "handle" character varying NOT NULL, "identityTier" character varying, "ssoEnforced" boolean NOT NULL DEFAULT false, "tenantLinkId" character varying, "linkedAt" TIMESTAMP, "linkedByUserId" character varying, "provisionKey" character varying, CONSTRAINT "PK_7b2f455c76f7dde86e744f840a2" PRIMARY KEY ("id"), CONSTRAINT "FK_812a14fb124451c164eb64ccefd" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f111c2f4d6a73e9bd6cb17a1bcb" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_39ace23f806ec450d069b21e3fc" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b0e627b377062c5d065ecb4948a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_69a470afba1e017cbbc7bef6d35" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_812a14fb124451c164eb64ccef" ON "zitadel_organization" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f111c2f4d6a73e9bd6cb17a1bc" ON "zitadel_organization" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_39ace23f806ec450d069b21e3f" ON "zitadel_organization" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_66a8ab723b19b471ee4b39522f" ON "zitadel_organization" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7ddea2ae8399e3f4a50814cff4" ON "zitadel_organization" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b0e627b377062c5d065ecb4948" ON "zitadel_organization" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_69a470afba1e017cbbc7bef6d3" ON "zitadel_organization" ("organizationId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_organization" ON "zitadel_organization" ("organizationId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_ever_org_tenant" ON "zitadel_organization" ("everOrgId", "tenantId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_provision_key" ON "zitadel_organization" ("provisionKey")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_session" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "sid" character varying NOT NULL, "userId" uuid NOT NULL, "accessTokenId" character varying, "refreshTokenId" character varying, CONSTRAINT "PK_9498352ec61d9421cf3407bbea0" PRIMARY KEY ("id"), CONSTRAINT "FK_0841e36d426bbc31c64bbb29940" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3533eea63e4eb106d2249093c10" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_67553c61502952e639e716ca465" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a58db2aa80b351d0ec7a1badb80" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6741ecd1ff22735b9898827ba0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0841e36d426bbc31c64bbb2994" ON "zitadel_session" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3533eea63e4eb106d2249093c1" ON "zitadel_session" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_67553c61502952e639e716ca46" ON "zitadel_session" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1d180deb2e090b778b4f2c007d" ON "zitadel_session" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_67184e6a523964adcefc353eac" ON "zitadel_session" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a58db2aa80b351d0ec7a1badb8" ON "zitadel_session" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b6741ecd1ff22735b9898827ba" ON "zitadel_session" ("userId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_session_sid" ON "zitadel_session" ("sid")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_session_created_at" ON "zitadel_session" ("createdAt")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_logout_jti" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "jti" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, CONSTRAINT "PK_8b7008553b96b76c5cd6c8514bb" PRIMARY KEY ("id"), CONSTRAINT "FK_1369a2b8f95720cf2e5928af711" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0870db5cba7d3bf0486e0fe2ec4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a7810819be66e6e74de3cc35112" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1369a2b8f95720cf2e5928af71" ON "zitadel_logout_jti" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0870db5cba7d3bf0486e0fe2ec" ON "zitadel_logout_jti" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a7810819be66e6e74de3cc3511" ON "zitadel_logout_jti" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_acb5d17921e6acc231454d008d" ON "zitadel_logout_jti" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e53ea21846d6b28cf89f3b4df1" ON "zitadel_logout_jti" ("isArchived")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_logout_jti_jti" ON "zitadel_logout_jti" ("jti")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_logout_jti_expires_at" ON "zitadel_logout_jti" ("expiresAt")`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`zitadel_account\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`issuer\` varchar(255) NOT NULL, \`subject\` varchar(255) NOT NULL, \`userId\` varchar(255) NOT NULL, \`everPersonId\` varchar(255) NULL, \`emailAtLink\` varchar(255) NULL, \`linkMethod\` varchar(255) NOT NULL, \`linkedAt\` datetime NOT NULL, \`lastLoginAt\` datetime NULL, INDEX \`IDX_88cedc817dd807dfeed2b2dfab\` (\`createdByUserId\`), INDEX \`IDX_f5420dde3595894663e952322c\` (\`updatedByUserId\`), INDEX \`IDX_a9b456f976ccbf1e872cb8e38a\` (\`deletedByUserId\`), INDEX \`IDX_6c507920191063266d93977e88\` (\`isActive\`), INDEX \`IDX_0bdf9bc760d5dd511309879934\` (\`isArchived\`), INDEX \`IDX_1977be8b0313e1367373dd5912\` (\`tenantId\`), INDEX \`IDX_84de5d3edd29690f1d28a59f91\` (\`userId\`), UNIQUE INDEX \`IDX_zitadel_account_issuer_subject_user\` (\`issuer\`, \`subject\`, \`userId\`), INDEX \`IDX_zitadel_account_issuer_subject\` (\`issuer\`, \`subject\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_88cedc817dd807dfeed2b2dfabc\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_f5420dde3595894663e952322c9\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_a9b456f976ccbf1e872cb8e38ae\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_1977be8b0313e1367373dd5912e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_84de5d3edd29690f1d28a59f91e\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`zitadel_organization\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`everOrgId\` varchar(255) NOT NULL, \`everTenantId\` varchar(255) NOT NULL, \`handle\` varchar(255) NOT NULL, \`identityTier\` varchar(255) NULL, \`ssoEnforced\` tinyint NOT NULL DEFAULT 0, \`tenantLinkId\` varchar(255) NULL, \`linkedAt\` datetime NULL, \`linkedByUserId\` varchar(255) NULL, \`provisionKey\` varchar(255) NULL, INDEX \`IDX_812a14fb124451c164eb64ccef\` (\`createdByUserId\`), INDEX \`IDX_f111c2f4d6a73e9bd6cb17a1bc\` (\`updatedByUserId\`), INDEX \`IDX_39ace23f806ec450d069b21e3f\` (\`deletedByUserId\`), INDEX \`IDX_66a8ab723b19b471ee4b39522f\` (\`isActive\`), INDEX \`IDX_7ddea2ae8399e3f4a50814cff4\` (\`isArchived\`), INDEX \`IDX_b0e627b377062c5d065ecb4948\` (\`tenantId\`), INDEX \`IDX_69a470afba1e017cbbc7bef6d3\` (\`organizationId\`), UNIQUE INDEX \`IDX_zitadel_organization_organization\` (\`organizationId\`), UNIQUE INDEX \`IDX_zitadel_organization_ever_org_tenant\` (\`everOrgId\`, \`tenantId\`), UNIQUE INDEX \`IDX_zitadel_organization_provision_key\` (\`provisionKey\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_812a14fb124451c164eb64ccefd\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_f111c2f4d6a73e9bd6cb17a1bcb\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_39ace23f806ec450d069b21e3fc\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_b0e627b377062c5d065ecb4948a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_69a470afba1e017cbbc7bef6d35\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`zitadel_session\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`sid\` varchar(255) NOT NULL, \`userId\` varchar(255) NOT NULL, \`accessTokenId\` varchar(255) NULL, \`refreshTokenId\` varchar(255) NULL, INDEX \`IDX_0841e36d426bbc31c64bbb2994\` (\`createdByUserId\`), INDEX \`IDX_3533eea63e4eb106d2249093c1\` (\`updatedByUserId\`), INDEX \`IDX_67553c61502952e639e716ca46\` (\`deletedByUserId\`), INDEX \`IDX_1d180deb2e090b778b4f2c007d\` (\`isActive\`), INDEX \`IDX_67184e6a523964adcefc353eac\` (\`isArchived\`), INDEX \`IDX_a58db2aa80b351d0ec7a1badb8\` (\`tenantId\`), INDEX \`IDX_b6741ecd1ff22735b9898827ba\` (\`userId\`), INDEX \`IDX_zitadel_session_sid\` (\`sid\`), INDEX \`IDX_zitadel_session_created_at\` (\`createdAt\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_0841e36d426bbc31c64bbb29940\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_3533eea63e4eb106d2249093c10\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_67553c61502952e639e716ca465\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_a58db2aa80b351d0ec7a1badb80\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_b6741ecd1ff22735b9898827ba0\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`zitadel_logout_jti\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`jti\` varchar(255) NOT NULL, \`expiresAt\` datetime NOT NULL, INDEX \`IDX_1369a2b8f95720cf2e5928af71\` (\`createdByUserId\`), INDEX \`IDX_0870db5cba7d3bf0486e0fe2ec\` (\`updatedByUserId\`), INDEX \`IDX_a7810819be66e6e74de3cc3511\` (\`deletedByUserId\`), INDEX \`IDX_acb5d17921e6acc231454d008d\` (\`isActive\`), INDEX \`IDX_e53ea21846d6b28cf89f3b4df1\` (\`isArchived\`), UNIQUE INDEX \`IDX_zitadel_logout_jti_jti\` (\`jti\`), INDEX \`IDX_zitadel_logout_jti_expires_at\` (\`expiresAt\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_1369a2b8f95720cf2e5928af711\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_0870db5cba7d3bf0486e0fe2ec4\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_a7810819be66e6e74de3cc35112\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_account" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "issuer" varchar NOT NULL, "subject" varchar NOT NULL, "userId" varchar NOT NULL, "everPersonId" varchar, "emailAtLink" varchar, "linkMethod" varchar NOT NULL, "linkedAt" datetime NOT NULL, "lastLoginAt" datetime, CONSTRAINT "FK_88cedc817dd807dfeed2b2dfabc" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f5420dde3595894663e952322c9" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a9b456f976ccbf1e872cb8e38ae" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1977be8b0313e1367373dd5912e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_84de5d3edd29690f1d28a59f91e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_88cedc817dd807dfeed2b2dfab" ON "zitadel_account" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f5420dde3595894663e952322c" ON "zitadel_account" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a9b456f976ccbf1e872cb8e38a" ON "zitadel_account" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6c507920191063266d93977e88" ON "zitadel_account" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0bdf9bc760d5dd511309879934" ON "zitadel_account" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1977be8b0313e1367373dd5912" ON "zitadel_account" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_84de5d3edd29690f1d28a59f91" ON "zitadel_account" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_account_issuer_subject_user" ON "zitadel_account" ("issuer", "subject", "userId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_account_issuer_subject" ON "zitadel_account" ("issuer", "subject")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_organization" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "everOrgId" varchar NOT NULL, "everTenantId" varchar NOT NULL, "handle" varchar NOT NULL, "identityTier" varchar, "ssoEnforced" boolean NOT NULL DEFAULT (0), "tenantLinkId" varchar, "linkedAt" datetime, "linkedByUserId" varchar, "provisionKey" varchar, CONSTRAINT "FK_812a14fb124451c164eb64ccefd" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f111c2f4d6a73e9bd6cb17a1bcb" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_39ace23f806ec450d069b21e3fc" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b0e627b377062c5d065ecb4948a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_69a470afba1e017cbbc7bef6d35" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_812a14fb124451c164eb64ccef" ON "zitadel_organization" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f111c2f4d6a73e9bd6cb17a1bc" ON "zitadel_organization" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_39ace23f806ec450d069b21e3f" ON "zitadel_organization" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_66a8ab723b19b471ee4b39522f" ON "zitadel_organization" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7ddea2ae8399e3f4a50814cff4" ON "zitadel_organization" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b0e627b377062c5d065ecb4948" ON "zitadel_organization" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_69a470afba1e017cbbc7bef6d3" ON "zitadel_organization" ("organizationId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_organization" ON "zitadel_organization" ("organizationId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_ever_org_tenant" ON "zitadel_organization" ("everOrgId", "tenantId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_organization_provision_key" ON "zitadel_organization" ("provisionKey")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "sid" varchar NOT NULL, "userId" varchar NOT NULL, "accessTokenId" varchar, "refreshTokenId" varchar, CONSTRAINT "FK_0841e36d426bbc31c64bbb29940" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3533eea63e4eb106d2249093c10" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_67553c61502952e639e716ca465" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a58db2aa80b351d0ec7a1badb80" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b6741ecd1ff22735b9898827ba0" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0841e36d426bbc31c64bbb2994" ON "zitadel_session" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3533eea63e4eb106d2249093c1" ON "zitadel_session" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_67553c61502952e639e716ca46" ON "zitadel_session" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1d180deb2e090b778b4f2c007d" ON "zitadel_session" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_67184e6a523964adcefc353eac" ON "zitadel_session" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a58db2aa80b351d0ec7a1badb8" ON "zitadel_session" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b6741ecd1ff22735b9898827ba" ON "zitadel_session" ("userId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_session_sid" ON "zitadel_session" ("sid")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_session_created_at" ON "zitadel_session" ("createdAt")`);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "zitadel_logout_jti" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "jti" varchar NOT NULL, "expiresAt" datetime NOT NULL, CONSTRAINT "FK_1369a2b8f95720cf2e5928af711" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0870db5cba7d3bf0486e0fe2ec4" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a7810819be66e6e74de3cc35112" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1369a2b8f95720cf2e5928af71" ON "zitadel_logout_jti" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0870db5cba7d3bf0486e0fe2ec" ON "zitadel_logout_jti" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a7810819be66e6e74de3cc3511" ON "zitadel_logout_jti" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_acb5d17921e6acc231454d008d" ON "zitadel_logout_jti" ("isActive")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e53ea21846d6b28cf89f3b4df1" ON "zitadel_logout_jti" ("isArchived")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zitadel_logout_jti_jti" ON "zitadel_logout_jti" ("jti")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_zitadel_logout_jti_expires_at" ON "zitadel_logout_jti" ("expiresAt")`);
	}
}
