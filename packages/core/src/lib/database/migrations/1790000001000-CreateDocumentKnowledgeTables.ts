import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateDocumentKnowledgeTables1790000001000 implements MigrationInterface {
    name = 'CreateDocumentKnowledgeTables1790000001000';

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
        // document_chunk ("embedding" is created as text on every dialect; migration 3 converts it to vector(1536) on PostgreSQL)
        await queryRunner.query(`CREATE TABLE "document_chunk" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "documentId" uuid NOT NULL, "chunkIndex" integer NOT NULL, "content" text NOT NULL, "embedding" text, "tokenCount" integer, "metadata" jsonb, CONSTRAINT "PK_70d9772bf367d82f9b7e568c87c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cd4ede89e57523beba30179a86" ON "document_chunk" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85ffe2609f4a134313c92053fc" ON "document_chunk" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d55f399772521fe3f0f68bdb19" ON "document_chunk" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a88633304a3a84f995f2452e9" ON "document_chunk" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_853e352e56455d5ad4ccc62e05" ON "document_chunk" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e492d914715e84721886716498" ON "document_chunk" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_272c678f7dcde215941cb14878" ON "document_chunk" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_chunk_tenant_org_doc" ON "document_chunk" ("tenantId", "organizationId", "documentId", "chunkIndex") `);
        // document_index_state
        await queryRunner.query(`CREATE TABLE "document_index_state" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "documentId" uuid NOT NULL, "embeddingModel" character varying(100) NOT NULL, "embeddingDims" integer NOT NULL, "chunkCount" integer NOT NULL DEFAULT 0, "lastIndexedAt" TIMESTAMP NOT NULL, "contentHash" character(64) NOT NULL, CONSTRAINT "PK_bd92f00678bea35792ec4471889" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eca75f1c7cd8ccae78e3cec573" ON "document_index_state" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8aea1d1804dc81a2aba462ac28" ON "document_index_state" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0537b721d4fe26fe007ce94bb7" ON "document_index_state" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f0e7ca737dfa2e6ebd7332ae6" ON "document_index_state" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_da6b5fb3ebd37ce1223382d941" ON "document_index_state" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6644976134e1e030ebcbd7905e" ON "document_index_state" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ab37ab35e5762beb66c561e90" ON "document_index_state" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_index_state_document" ON "document_index_state" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_index_state_model" ON "document_index_state" ("tenantId", "organizationId", "embeddingModel") `);
        // foreign keys: document_chunk
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_cd4ede89e57523beba30179a866" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_85ffe2609f4a134313c92053fca" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_d55f399772521fe3f0f68bdb19e" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_e492d914715e847218867164987" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_272c678f7dcde215941cb148784" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_3e9a852328831b703e5ef175ca8" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: document_index_state
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_eca75f1c7cd8ccae78e3cec573b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_8aea1d1804dc81a2aba462ac285" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_0537b721d4fe26fe007ce94bb7e" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_6644976134e1e030ebcbd7905e3" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_8ab37ab35e5762beb66c561e908" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_index_state" ADD CONSTRAINT "FK_dbd66b42dd64b7fd034c45a6a85" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_dbd66b42dd64b7fd034c45a6a85"`);
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_8ab37ab35e5762beb66c561e908"`);
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_6644976134e1e030ebcbd7905e3"`);
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_0537b721d4fe26fe007ce94bb7e"`);
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_8aea1d1804dc81a2aba462ac285"`);
        await queryRunner.query(`ALTER TABLE "document_index_state" DROP CONSTRAINT "FK_eca75f1c7cd8ccae78e3cec573b"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_3e9a852328831b703e5ef175ca8"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_272c678f7dcde215941cb148784"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_e492d914715e847218867164987"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_d55f399772521fe3f0f68bdb19e"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_85ffe2609f4a134313c92053fca"`);
        await queryRunner.query(`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_cd4ede89e57523beba30179a866"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_index_state_model"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_index_state_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ab37ab35e5762beb66c561e90"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6644976134e1e030ebcbd7905e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da6b5fb3ebd37ce1223382d941"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f0e7ca737dfa2e6ebd7332ae6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0537b721d4fe26fe007ce94bb7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8aea1d1804dc81a2aba462ac28"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eca75f1c7cd8ccae78e3cec573"`);
        await queryRunner.query(`DROP TABLE "document_index_state"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_chunk_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_272c678f7dcde215941cb14878"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e492d914715e84721886716498"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_853e352e56455d5ad4ccc62e05"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a88633304a3a84f995f2452e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d55f399772521fe3f0f68bdb19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85ffe2609f4a134313c92053fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd4ede89e57523beba30179a86"`);
        await queryRunner.query(`DROP TABLE "document_chunk"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        // document_chunk
        await queryRunner.query(`CREATE TABLE "document_chunk" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "documentId" varchar NOT NULL, "chunkIndex" integer NOT NULL, "content" text NOT NULL, "embedding" text, "tokenCount" integer, "metadata" text, CONSTRAINT "FK_cd4ede89e57523beba30179a866" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_85ffe2609f4a134313c92053fca" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d55f399772521fe3f0f68bdb19e" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e492d914715e847218867164987" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_272c678f7dcde215941cb148784" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3e9a852328831b703e5ef175ca8" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_cd4ede89e57523beba30179a86" ON "document_chunk" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85ffe2609f4a134313c92053fc" ON "document_chunk" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d55f399772521fe3f0f68bdb19" ON "document_chunk" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a88633304a3a84f995f2452e9" ON "document_chunk" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_853e352e56455d5ad4ccc62e05" ON "document_chunk" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e492d914715e84721886716498" ON "document_chunk" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_272c678f7dcde215941cb14878" ON "document_chunk" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_chunk_tenant_org_doc" ON "document_chunk" ("tenantId", "organizationId", "documentId", "chunkIndex") `);
        // document_index_state
        await queryRunner.query(`CREATE TABLE "document_index_state" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "documentId" varchar NOT NULL, "embeddingModel" varchar(100) NOT NULL, "embeddingDims" integer NOT NULL, "chunkCount" integer NOT NULL DEFAULT (0), "lastIndexedAt" datetime NOT NULL, "contentHash" varchar(64) NOT NULL, CONSTRAINT "FK_eca75f1c7cd8ccae78e3cec573b" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8aea1d1804dc81a2aba462ac285" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0537b721d4fe26fe007ce94bb7e" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6644976134e1e030ebcbd7905e3" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8ab37ab35e5762beb66c561e908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_dbd66b42dd64b7fd034c45a6a85" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_eca75f1c7cd8ccae78e3cec573" ON "document_index_state" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8aea1d1804dc81a2aba462ac28" ON "document_index_state" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0537b721d4fe26fe007ce94bb7" ON "document_index_state" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f0e7ca737dfa2e6ebd7332ae6" ON "document_index_state" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_da6b5fb3ebd37ce1223382d941" ON "document_index_state" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6644976134e1e030ebcbd7905e" ON "document_index_state" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ab37ab35e5762beb66c561e90" ON "document_index_state" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_index_state_document" ON "document_index_state" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_index_state_model" ON "document_index_state" ("tenantId", "organizationId", "embeddingModel") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_document_index_state_model"`);
        await queryRunner.query(`DROP INDEX "IDX_document_index_state_document"`);
        await queryRunner.query(`DROP INDEX "IDX_8ab37ab35e5762beb66c561e90"`);
        await queryRunner.query(`DROP INDEX "IDX_6644976134e1e030ebcbd7905e"`);
        await queryRunner.query(`DROP INDEX "IDX_da6b5fb3ebd37ce1223382d941"`);
        await queryRunner.query(`DROP INDEX "IDX_9f0e7ca737dfa2e6ebd7332ae6"`);
        await queryRunner.query(`DROP INDEX "IDX_0537b721d4fe26fe007ce94bb7"`);
        await queryRunner.query(`DROP INDEX "IDX_8aea1d1804dc81a2aba462ac28"`);
        await queryRunner.query(`DROP INDEX "IDX_eca75f1c7cd8ccae78e3cec573"`);
        await queryRunner.query(`DROP TABLE "document_index_state"`);
        await queryRunner.query(`DROP INDEX "IDX_document_chunk_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "IDX_272c678f7dcde215941cb14878"`);
        await queryRunner.query(`DROP INDEX "IDX_e492d914715e84721886716498"`);
        await queryRunner.query(`DROP INDEX "IDX_853e352e56455d5ad4ccc62e05"`);
        await queryRunner.query(`DROP INDEX "IDX_8a88633304a3a84f995f2452e9"`);
        await queryRunner.query(`DROP INDEX "IDX_d55f399772521fe3f0f68bdb19"`);
        await queryRunner.query(`DROP INDEX "IDX_85ffe2609f4a134313c92053fc"`);
        await queryRunner.query(`DROP INDEX "IDX_cd4ede89e57523beba30179a86"`);
        await queryRunner.query(`DROP TABLE "document_chunk"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        // document_chunk
        await queryRunner.query(`CREATE TABLE \`document_chunk\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`documentId\` varchar(36) NOT NULL, \`chunkIndex\` int NOT NULL, \`content\` text NOT NULL, \`embedding\` text NULL, \`tokenCount\` int NULL, \`metadata\` json NULL, INDEX \`IDX_cd4ede89e57523beba30179a86\` (\`createdByUserId\`), INDEX \`IDX_85ffe2609f4a134313c92053fc\` (\`updatedByUserId\`), INDEX \`IDX_d55f399772521fe3f0f68bdb19\` (\`deletedByUserId\`), INDEX \`IDX_8a88633304a3a84f995f2452e9\` (\`isActive\`), INDEX \`IDX_853e352e56455d5ad4ccc62e05\` (\`isArchived\`), INDEX \`IDX_e492d914715e84721886716498\` (\`tenantId\`), INDEX \`IDX_272c678f7dcde215941cb14878\` (\`organizationId\`), UNIQUE INDEX \`IDX_document_chunk_tenant_org_doc\` (\`tenantId\`, \`organizationId\`, \`documentId\`, \`chunkIndex\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // document_index_state
        await queryRunner.query(`CREATE TABLE \`document_index_state\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`documentId\` varchar(36) NOT NULL, \`embeddingModel\` varchar(100) NOT NULL, \`embeddingDims\` int NOT NULL, \`chunkCount\` int NOT NULL DEFAULT 0, \`lastIndexedAt\` datetime NOT NULL, \`contentHash\` char(64) NOT NULL, INDEX \`IDX_eca75f1c7cd8ccae78e3cec573\` (\`createdByUserId\`), INDEX \`IDX_8aea1d1804dc81a2aba462ac28\` (\`updatedByUserId\`), INDEX \`IDX_0537b721d4fe26fe007ce94bb7\` (\`deletedByUserId\`), INDEX \`IDX_9f0e7ca737dfa2e6ebd7332ae6\` (\`isActive\`), INDEX \`IDX_da6b5fb3ebd37ce1223382d941\` (\`isArchived\`), INDEX \`IDX_6644976134e1e030ebcbd7905e\` (\`tenantId\`), INDEX \`IDX_8ab37ab35e5762beb66c561e90\` (\`organizationId\`), UNIQUE INDEX \`IDX_document_index_state_document\` (\`documentId\`), INDEX \`IDX_document_index_state_model\` (\`tenantId\`, \`organizationId\`, \`embeddingModel\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // foreign keys: document_chunk
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_cd4ede89e57523beba30179a866\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_85ffe2609f4a134313c92053fca\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_d55f399772521fe3f0f68bdb19e\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_e492d914715e847218867164987\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_272c678f7dcde215941cb148784\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` ADD CONSTRAINT \`FK_3e9a852328831b703e5ef175ca8\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: document_index_state
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_eca75f1c7cd8ccae78e3cec573b\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_8aea1d1804dc81a2aba462ac285\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_0537b721d4fe26fe007ce94bb7e\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_6644976134e1e030ebcbd7905e3\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_8ab37ab35e5762beb66c561e908\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` ADD CONSTRAINT \`FK_dbd66b42dd64b7fd034c45a6a85\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_dbd66b42dd64b7fd034c45a6a85\``);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_8ab37ab35e5762beb66c561e908\``);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_6644976134e1e030ebcbd7905e3\``);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_0537b721d4fe26fe007ce94bb7e\``);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_8aea1d1804dc81a2aba462ac285\``);
        await queryRunner.query(`ALTER TABLE \`document_index_state\` DROP FOREIGN KEY \`FK_eca75f1c7cd8ccae78e3cec573b\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_3e9a852328831b703e5ef175ca8\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_272c678f7dcde215941cb148784\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_e492d914715e847218867164987\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_d55f399772521fe3f0f68bdb19e\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_85ffe2609f4a134313c92053fca\``);
        await queryRunner.query(`ALTER TABLE \`document_chunk\` DROP FOREIGN KEY \`FK_cd4ede89e57523beba30179a866\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_index_state_model\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_index_state_document\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_8ab37ab35e5762beb66c561e90\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_6644976134e1e030ebcbd7905e\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_da6b5fb3ebd37ce1223382d941\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_9f0e7ca737dfa2e6ebd7332ae6\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_0537b721d4fe26fe007ce94bb7\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_8aea1d1804dc81a2aba462ac28\` ON \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_eca75f1c7cd8ccae78e3cec573\` ON \`document_index_state\``);
        await queryRunner.query(`DROP TABLE \`document_index_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_chunk_tenant_org_doc\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_272c678f7dcde215941cb14878\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_e492d914715e84721886716498\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_853e352e56455d5ad4ccc62e05\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_8a88633304a3a84f995f2452e9\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_d55f399772521fe3f0f68bdb19\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_85ffe2609f4a134313c92053fc\` ON \`document_chunk\``);
        await queryRunner.query(`DROP INDEX \`IDX_cd4ede89e57523beba30179a86\` ON \`document_chunk\``);
        await queryRunner.query(`DROP TABLE \`document_chunk\``);
    }
}
