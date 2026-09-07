import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateDocumentTables1790000000000 implements MigrationInterface {
    name = 'CreateDocumentTables1790000000000';

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
        // document
        await queryRunner.query(`CREATE TABLE "document" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "kind" character varying(16) NOT NULL, "parentId" uuid, "index" integer NOT NULL DEFAULT 0, "name" character varying(255) NOT NULL, "icon" character varying(255), "color" character varying(32), "description" character varying(500), "contentJson" jsonb, "contentHtml" text, "contentBinary" bytea, "isLocked" boolean NOT NULL DEFAULT false, "storageProvider" character varying(20), "storageKey" character varying(1024), "thumbKey" character varying(1024), "mimeType" character varying(127), "fileSize" bigint, "sha256" character(64), "originalFilename" character varying(255), "version" integer NOT NULL DEFAULT 1, "extractedText" text, "extractedTextEdited" boolean NOT NULL DEFAULT false, "summary" text, "status" character varying(16) NOT NULL DEFAULT 'READY', "statusMessage" character varying(500), "source" character varying(16) NOT NULL DEFAULT 'UPLOAD', "knowledgeStatus" character varying(16) NOT NULL DEFAULT 'NONE', "aiConfidence" double precision, "searchable" boolean NOT NULL DEFAULT true, "reviewStatus" character varying(16) NOT NULL DEFAULT 'NONE', "reviewReason" character varying(32), "reviewedById" uuid, "reviewedAt" TIMESTAMP, "visibility" character varying(16) NOT NULL DEFAULT 'ORGANIZATION', "externalSource" character varying(64), "externalId" character varying(255), "metadata" jsonb, CONSTRAINT "PK_e57d3357f83f3cdc0acffc3d777" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8c3f23b3e8255bb1f8de9e8a8a" ON "document" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b01d534c51f8b3ada3d197eba5" ON "document" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1da73b5c7e7cec72b293efd5f8" ON "document" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a603fd0077a3b0fcaefa6c5d6d" ON "document" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_717bc1a8b39d958af835a5726c" ON "document" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_d082f1233074e049d2322298b3" ON "document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dfcea06c9f090a968a8076dccb" ON "document" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_parent" ON "document" ("tenantId", "organizationId", "parentId", "index") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_updated" ON "document" ("tenantId", "organizationId", "updatedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_kind" ON "document" ("tenantId", "organizationId", "kind") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_status" ON "document" ("tenantId", "organizationId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_knowledge" ON "document" ("tenantId", "organizationId", "knowledgeStatus") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_review" ON "document" ("tenantId", "organizationId", "reviewStatus") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_source" ON "document" ("tenantId", "organizationId", "source") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_visibility" ON "document" ("tenantId", "organizationId", "visibility") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_sha256" ON "document" ("tenantId", "organizationId", "sha256") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_document_external_provenance" ON "document" ("tenantId", "organizationId", "externalSource", "externalId") WHERE "externalSource" IS NOT NULL`);
        // document_category
        await queryRunner.query(`CREATE TABLE "document_category" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(100) NOT NULL, "slug" character varying(150) NOT NULL, "color" character varying(32), "icon" character varying(255), "description" character varying(500), "isSystem" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_11a733c8aee6a87016ac1fabc2a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3a3aa5fad169bfb9fad21813fc" ON "document_category" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ede572034ada795415af3f29d0" ON "document_category" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_944bb6d347070ee3f241eef1f7" ON "document_category" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe4fb219a5b31f44caa0724cc6" ON "document_category" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b0b8a75ea1ea86d1fa9e2fac9" ON "document_category" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe2878916db7be7161d843151c" ON "document_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24ef316ff7d7353633cdbaabe7" ON "document_category" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_category_tenant_org_slug" ON "document_category" ("tenantId", "organizationId", "slug") `);
        // document_version
        await queryRunner.query(`CREATE TABLE "document_version" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "documentId" uuid NOT NULL, "name" character varying(255) NOT NULL, "contentJson" jsonb, "contentHtml" text, "contentBinary" bytea, "lastSavedAt" TIMESTAMP NOT NULL, "createdById" uuid, CONSTRAINT "PK_a4c39c95456c5dbb2e96cca713c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3b72659dc7b4e993a97adbb35f" ON "document_version" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5bedca89667b4b5de237df62aa" ON "document_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8df7822a69e7cee233eaff7685" ON "document_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fefa36f6b6fe1b6975b753058" ON "document_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_153fb6d3b13a3af6162322bd3a" ON "document_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_81869ef9c3afdc5dbbc80e3d01" ON "document_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_afdd770dac49069d8ff1bf935a" ON "document_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_version_doc_saved" ON "document_version" ("documentId", "lastSavedAt") `);
        // document_share
        await queryRunner.query(`CREATE TABLE "document_share" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "documentId" uuid NOT NULL, "employeeId" uuid, "teamId" uuid, "access" character varying(16) NOT NULL DEFAULT 'VIEW', CONSTRAINT "CHK_document_share_target_xor" CHECK ((("employeeId" IS NULL) <> ("teamId" IS NULL))), CONSTRAINT "PK_bc6df70399154d550751979fa3e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e281f8b0ab90dc09f8adb000bd" ON "document_share" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_02fa2e56f791f1b6ed28f25e59" ON "document_share" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_059308c9e6993694ac857d1a7a" ON "document_share" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_454de111ab22e99136418f2c06" ON "document_share" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_173905c6387fb6a20de352e152" ON "document_share" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_c64e8c2bcf715bea4793a2125f" ON "document_share" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b1eebd6488d856f86bb914376" ON "document_share" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e6ab4f8f62752db1db1fce8ae" ON "document_share" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d4f897f0b1943ebfb89fc6dfe" ON "document_share" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_share_tenant_org_doc" ON "document_share" ("tenantId", "organizationId", "documentId") `);
        // document_link
        await queryRunner.query(`CREATE TABLE "document_link" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "documentId" uuid NOT NULL, "entity" character varying(50) NOT NULL, "entityId" uuid NOT NULL, "metadata" jsonb, CONSTRAINT "PK_11a03710e8ed95257c3278518f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_54634b938b40fc98d219872581" ON "document_link" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84af04861ef11e778d8cab8862" ON "document_link" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ff4f2a3e7821fc1192cc9b3d9" ON "document_link" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_01c18a0c7f26203563000fe676" ON "document_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9922d47459cb047bed71f417b" ON "document_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8d11a840d7679532a6b56d21c9" ON "document_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4ecaf9d1c342a99c1fec89d3f" ON "document_link" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_link_unique" ON "document_link" ("documentId", "entity", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_link_tenant_org_entity" ON "document_link" ("tenantId", "organizationId", "entity", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_link_tenant_org_doc" ON "document_link" ("tenantId", "organizationId", "documentId") `);
        // pivot: tag_document
        await queryRunner.query(`CREATE TABLE "tag_document" ("documentId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_58aeb37dfb7a0d3a1bc598134f4" PRIMARY KEY ("documentId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tag_document_documentId" ON "tag_document" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_tag_document_tagId" ON "tag_document" ("tagId") `);
        // pivot: document_category_document
        await queryRunner.query(`CREATE TABLE "document_category_document" ("documentId" uuid NOT NULL, "documentCategoryId" uuid NOT NULL, CONSTRAINT "PK_4bb28a8bac5a10d20f88621f3f6" PRIMARY KEY ("documentId", "documentCategoryId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dcd_documentId" ON "document_category_document" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dcd_documentCategoryId" ON "document_category_document" ("documentCategoryId") `);
        // foreign keys: document
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_8c3f23b3e8255bb1f8de9e8a8ae" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_b01d534c51f8b3ada3d197eba5d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_1da73b5c7e7cec72b293efd5f8f" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_d082f1233074e049d2322298b3d" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_dfcea06c9f090a968a8076dccb5" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_4c4ae8a7a98116d84d0ecb087b9" FOREIGN KEY ("parentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_8eb97311a105c34bdf58c6a0cfd" FOREIGN KEY ("reviewedById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        // foreign keys: document_category
        await queryRunner.query(`ALTER TABLE "document_category" ADD CONSTRAINT "FK_3a3aa5fad169bfb9fad21813fca" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_category" ADD CONSTRAINT "FK_ede572034ada795415af3f29d04" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_category" ADD CONSTRAINT "FK_944bb6d347070ee3f241eef1f7d" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_category" ADD CONSTRAINT "FK_fe2878916db7be7161d843151c6" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_category" ADD CONSTRAINT "FK_24ef316ff7d7353633cdbaabe75" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        // foreign keys: document_version
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_3b72659dc7b4e993a97adbb35fe" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_5bedca89667b4b5de237df62aa9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_8df7822a69e7cee233eaff76856" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_81869ef9c3afdc5dbbc80e3d018" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_afdd770dac49069d8ff1bf935aa" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_798ac949e0d25e76695ffc7776a" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_version" ADD CONSTRAINT "FK_0a245cd17ebaa45ff65d8a00463" FOREIGN KEY ("createdById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        // foreign keys: document_share
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_e281f8b0ab90dc09f8adb000bde" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_02fa2e56f791f1b6ed28f25e594" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_059308c9e6993694ac857d1a7a1" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_c64e8c2bcf715bea4793a2125fd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_9b1eebd6488d856f86bb9143768" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_77fea374fc99c5934c2eddd25a1" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_5e6ab4f8f62752db1db1fce8aed" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_share" ADD CONSTRAINT "FK_9d4f897f0b1943ebfb89fc6dfe3" FOREIGN KEY ("teamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: document_link
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_54634b938b40fc98d2198725818" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_84af04861ef11e778d8cab88625" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_7ff4f2a3e7821fc1192cc9b3d98" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_8d11a840d7679532a6b56d21c99" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_f4ecaf9d1c342a99c1fec89d3f8" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_link" ADD CONSTRAINT "FK_db2b6843cf6bb119a534d5a7cef" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: pivots
        await queryRunner.query(`ALTER TABLE "tag_document" ADD CONSTRAINT "FK_05bc0d46914866851710ab20afc" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tag_document" ADD CONSTRAINT "FK_3538faddef46acd460dd845d73c" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_category_document" ADD CONSTRAINT "FK_1f131e15d0fc8d085e3ec830940" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "document_category_document" ADD CONSTRAINT "FK_05b2174451a206cffa7bc477ba2" FOREIGN KEY ("documentCategoryId") REFERENCES "document_category"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "document_category_document" DROP CONSTRAINT "FK_05b2174451a206cffa7bc477ba2"`);
        await queryRunner.query(`ALTER TABLE "document_category_document" DROP CONSTRAINT "FK_1f131e15d0fc8d085e3ec830940"`);
        await queryRunner.query(`ALTER TABLE "tag_document" DROP CONSTRAINT "FK_3538faddef46acd460dd845d73c"`);
        await queryRunner.query(`ALTER TABLE "tag_document" DROP CONSTRAINT "FK_05bc0d46914866851710ab20afc"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_db2b6843cf6bb119a534d5a7cef"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_f4ecaf9d1c342a99c1fec89d3f8"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_8d11a840d7679532a6b56d21c99"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_7ff4f2a3e7821fc1192cc9b3d98"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_84af04861ef11e778d8cab88625"`);
        await queryRunner.query(`ALTER TABLE "document_link" DROP CONSTRAINT "FK_54634b938b40fc98d2198725818"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_9d4f897f0b1943ebfb89fc6dfe3"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_5e6ab4f8f62752db1db1fce8aed"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_77fea374fc99c5934c2eddd25a1"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_9b1eebd6488d856f86bb9143768"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_c64e8c2bcf715bea4793a2125fd"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_059308c9e6993694ac857d1a7a1"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_02fa2e56f791f1b6ed28f25e594"`);
        await queryRunner.query(`ALTER TABLE "document_share" DROP CONSTRAINT "FK_e281f8b0ab90dc09f8adb000bde"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_0a245cd17ebaa45ff65d8a00463"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_798ac949e0d25e76695ffc7776a"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_afdd770dac49069d8ff1bf935aa"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_81869ef9c3afdc5dbbc80e3d018"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_8df7822a69e7cee233eaff76856"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_5bedca89667b4b5de237df62aa9"`);
        await queryRunner.query(`ALTER TABLE "document_version" DROP CONSTRAINT "FK_3b72659dc7b4e993a97adbb35fe"`);
        await queryRunner.query(`ALTER TABLE "document_category" DROP CONSTRAINT "FK_24ef316ff7d7353633cdbaabe75"`);
        await queryRunner.query(`ALTER TABLE "document_category" DROP CONSTRAINT "FK_fe2878916db7be7161d843151c6"`);
        await queryRunner.query(`ALTER TABLE "document_category" DROP CONSTRAINT "FK_944bb6d347070ee3f241eef1f7d"`);
        await queryRunner.query(`ALTER TABLE "document_category" DROP CONSTRAINT "FK_ede572034ada795415af3f29d04"`);
        await queryRunner.query(`ALTER TABLE "document_category" DROP CONSTRAINT "FK_3a3aa5fad169bfb9fad21813fca"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_8eb97311a105c34bdf58c6a0cfd"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_4c4ae8a7a98116d84d0ecb087b9"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_dfcea06c9f090a968a8076dccb5"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_d082f1233074e049d2322298b3d"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_1da73b5c7e7cec72b293efd5f8f"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_b01d534c51f8b3ada3d197eba5d"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_8c3f23b3e8255bb1f8de9e8a8ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dcd_documentCategoryId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dcd_documentId"`);
        await queryRunner.query(`DROP TABLE "document_category_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tag_document_tagId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tag_document_documentId"`);
        await queryRunner.query(`DROP TABLE "tag_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_link_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_link_tenant_org_entity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_link_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4ecaf9d1c342a99c1fec89d3f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d11a840d7679532a6b56d21c9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f9922d47459cb047bed71f417b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01c18a0c7f26203563000fe676"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ff4f2a3e7821fc1192cc9b3d9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84af04861ef11e778d8cab8862"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_54634b938b40fc98d219872581"`);
        await queryRunner.query(`DROP TABLE "document_link"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_share_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d4f897f0b1943ebfb89fc6dfe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e6ab4f8f62752db1db1fce8ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b1eebd6488d856f86bb914376"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c64e8c2bcf715bea4793a2125f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_173905c6387fb6a20de352e152"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_454de111ab22e99136418f2c06"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_059308c9e6993694ac857d1a7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02fa2e56f791f1b6ed28f25e59"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e281f8b0ab90dc09f8adb000bd"`);
        await queryRunner.query(`DROP TABLE "document_share"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_version_doc_saved"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_afdd770dac49069d8ff1bf935a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81869ef9c3afdc5dbbc80e3d01"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_153fb6d3b13a3af6162322bd3a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6fefa36f6b6fe1b6975b753058"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8df7822a69e7cee233eaff7685"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5bedca89667b4b5de237df62aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b72659dc7b4e993a97adbb35f"`);
        await queryRunner.query(`DROP TABLE "document_version"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_category_tenant_org_slug"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_24ef316ff7d7353633cdbaabe7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe2878916db7be7161d843151c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b0b8a75ea1ea86d1fa9e2fac9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe4fb219a5b31f44caa0724cc6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_944bb6d347070ee3f241eef1f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ede572034ada795415af3f29d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a3aa5fad169bfb9fad21813fc"`);
        await queryRunner.query(`DROP TABLE "document_category"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_document_external_provenance"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_sha256"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_visibility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_source"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_review"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_knowledge"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_kind"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_updated"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_document_tenant_org_parent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dfcea06c9f090a968a8076dccb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d082f1233074e049d2322298b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_717bc1a8b39d958af835a5726c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a603fd0077a3b0fcaefa6c5d6d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1da73b5c7e7cec72b293efd5f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b01d534c51f8b3ada3d197eba5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c3f23b3e8255bb1f8de9e8a8a"`);
        await queryRunner.query(`DROP TABLE "document"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        // document (FKs declared inline — SQLite cannot add constraints after create)
        await queryRunner.query(`CREATE TABLE "document" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "kind" varchar(16) NOT NULL, "parentId" varchar, "index" integer NOT NULL DEFAULT (0), "name" varchar(255) NOT NULL, "icon" varchar(255), "color" varchar(32), "description" varchar(500), "contentJson" text, "contentHtml" text, "contentBinary" blob, "isLocked" boolean NOT NULL DEFAULT (0), "storageProvider" varchar(20), "storageKey" varchar(1024), "thumbKey" varchar(1024), "mimeType" varchar(127), "fileSize" integer, "sha256" varchar(64), "originalFilename" varchar(255), "version" integer NOT NULL DEFAULT (1), "extractedText" text, "extractedTextEdited" boolean NOT NULL DEFAULT (0), "summary" text, "status" varchar(16) NOT NULL DEFAULT ('READY'), "statusMessage" varchar(500), "source" varchar(16) NOT NULL DEFAULT ('UPLOAD'), "knowledgeStatus" varchar(16) NOT NULL DEFAULT ('NONE'), "aiConfidence" real, "searchable" boolean NOT NULL DEFAULT (1), "reviewStatus" varchar(16) NOT NULL DEFAULT ('NONE'), "reviewReason" varchar(32), "reviewedById" varchar, "reviewedAt" datetime, "visibility" varchar(16) NOT NULL DEFAULT ('ORGANIZATION'), "externalSource" varchar(64), "externalId" varchar(255), "metadata" text, CONSTRAINT "FK_8c3f23b3e8255bb1f8de9e8a8ae" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b01d534c51f8b3ada3d197eba5d" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1da73b5c7e7cec72b293efd5f8f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d082f1233074e049d2322298b3d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dfcea06c9f090a968a8076dccb5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4c4ae8a7a98116d84d0ecb087b9" FOREIGN KEY ("parentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8eb97311a105c34bdf58c6a0cfd" FOREIGN KEY ("reviewedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_8c3f23b3e8255bb1f8de9e8a8a" ON "document" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b01d534c51f8b3ada3d197eba5" ON "document" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1da73b5c7e7cec72b293efd5f8" ON "document" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a603fd0077a3b0fcaefa6c5d6d" ON "document" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_717bc1a8b39d958af835a5726c" ON "document" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_d082f1233074e049d2322298b3" ON "document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dfcea06c9f090a968a8076dccb" ON "document" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_parent" ON "document" ("tenantId", "organizationId", "parentId", "index") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_updated" ON "document" ("tenantId", "organizationId", "updatedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_kind" ON "document" ("tenantId", "organizationId", "kind") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_status" ON "document" ("tenantId", "organizationId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_knowledge" ON "document" ("tenantId", "organizationId", "knowledgeStatus") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_review" ON "document" ("tenantId", "organizationId", "reviewStatus") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_source" ON "document" ("tenantId", "organizationId", "source") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_visibility" ON "document" ("tenantId", "organizationId", "visibility") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_tenant_org_sha256" ON "document" ("tenantId", "organizationId", "sha256") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_document_external_provenance" ON "document" ("tenantId", "organizationId", "externalSource", "externalId") WHERE "externalSource" IS NOT NULL`);
        // document_category
        await queryRunner.query(`CREATE TABLE "document_category" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(100) NOT NULL, "slug" varchar(150) NOT NULL, "color" varchar(32), "icon" varchar(255), "description" varchar(500), "isSystem" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_3a3aa5fad169bfb9fad21813fca" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ede572034ada795415af3f29d04" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_944bb6d347070ee3f241eef1f7d" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fe2878916db7be7161d843151c6" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_24ef316ff7d7353633cdbaabe75" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`CREATE INDEX "IDX_3a3aa5fad169bfb9fad21813fc" ON "document_category" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ede572034ada795415af3f29d0" ON "document_category" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_944bb6d347070ee3f241eef1f7" ON "document_category" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe4fb219a5b31f44caa0724cc6" ON "document_category" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b0b8a75ea1ea86d1fa9e2fac9" ON "document_category" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe2878916db7be7161d843151c" ON "document_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24ef316ff7d7353633cdbaabe7" ON "document_category" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_category_tenant_org_slug" ON "document_category" ("tenantId", "organizationId", "slug") `);
        // document_version
        await queryRunner.query(`CREATE TABLE "document_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "documentId" varchar NOT NULL, "name" varchar(255) NOT NULL, "contentJson" text, "contentHtml" text, "contentBinary" blob, "lastSavedAt" datetime NOT NULL, "createdById" varchar, CONSTRAINT "FK_3b72659dc7b4e993a97adbb35fe" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5bedca89667b4b5de237df62aa9" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8df7822a69e7cee233eaff76856" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_81869ef9c3afdc5dbbc80e3d018" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_afdd770dac49069d8ff1bf935aa" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_798ac949e0d25e76695ffc7776a" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0a245cd17ebaa45ff65d8a00463" FOREIGN KEY ("createdById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_3b72659dc7b4e993a97adbb35f" ON "document_version" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5bedca89667b4b5de237df62aa" ON "document_version" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8df7822a69e7cee233eaff7685" ON "document_version" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6fefa36f6b6fe1b6975b753058" ON "document_version" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_153fb6d3b13a3af6162322bd3a" ON "document_version" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_81869ef9c3afdc5dbbc80e3d01" ON "document_version" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_afdd770dac49069d8ff1bf935a" ON "document_version" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_version_doc_saved" ON "document_version" ("documentId", "lastSavedAt") `);
        // document_share
        await queryRunner.query(`CREATE TABLE "document_share" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "documentId" varchar NOT NULL, "employeeId" varchar, "teamId" varchar, "access" varchar(16) NOT NULL DEFAULT ('VIEW'), CONSTRAINT "CHK_document_share_target_xor" CHECK ((("employeeId" IS NULL) <> ("teamId" IS NULL))), CONSTRAINT "FK_e281f8b0ab90dc09f8adb000bde" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_02fa2e56f791f1b6ed28f25e594" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_059308c9e6993694ac857d1a7a1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c64e8c2bcf715bea4793a2125fd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b1eebd6488d856f86bb9143768" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_77fea374fc99c5934c2eddd25a1" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e6ab4f8f62752db1db1fce8aed" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d4f897f0b1943ebfb89fc6dfe3" FOREIGN KEY ("teamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_e281f8b0ab90dc09f8adb000bd" ON "document_share" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_02fa2e56f791f1b6ed28f25e59" ON "document_share" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_059308c9e6993694ac857d1a7a" ON "document_share" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_454de111ab22e99136418f2c06" ON "document_share" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_173905c6387fb6a20de352e152" ON "document_share" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_c64e8c2bcf715bea4793a2125f" ON "document_share" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b1eebd6488d856f86bb914376" ON "document_share" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e6ab4f8f62752db1db1fce8ae" ON "document_share" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d4f897f0b1943ebfb89fc6dfe" ON "document_share" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_share_tenant_org_doc" ON "document_share" ("tenantId", "organizationId", "documentId") `);
        // document_link
        await queryRunner.query(`CREATE TABLE "document_link" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "documentId" varchar NOT NULL, "entity" varchar(50) NOT NULL, "entityId" varchar NOT NULL, "metadata" text, CONSTRAINT "FK_54634b938b40fc98d2198725818" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_84af04861ef11e778d8cab88625" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7ff4f2a3e7821fc1192cc9b3d98" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8d11a840d7679532a6b56d21c99" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f4ecaf9d1c342a99c1fec89d3f8" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_db2b6843cf6bb119a534d5a7cef" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_54634b938b40fc98d219872581" ON "document_link" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84af04861ef11e778d8cab8862" ON "document_link" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ff4f2a3e7821fc1192cc9b3d9" ON "document_link" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_01c18a0c7f26203563000fe676" ON "document_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9922d47459cb047bed71f417b" ON "document_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_8d11a840d7679532a6b56d21c9" ON "document_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4ecaf9d1c342a99c1fec89d3f" ON "document_link" ("organizationId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_document_link_unique" ON "document_link" ("documentId", "entity", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_link_tenant_org_entity" ON "document_link" ("tenantId", "organizationId", "entity", "entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_document_link_tenant_org_doc" ON "document_link" ("tenantId", "organizationId", "documentId") `);
        // pivot: tag_document
        await queryRunner.query(`CREATE TABLE "tag_document" ("documentId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_05bc0d46914866851710ab20afc" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3538faddef46acd460dd845d73c" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("documentId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tag_document_documentId" ON "tag_document" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_tag_document_tagId" ON "tag_document" ("tagId") `);
        // pivot: document_category_document
        await queryRunner.query(`CREATE TABLE "document_category_document" ("documentId" varchar NOT NULL, "documentCategoryId" varchar NOT NULL, CONSTRAINT "FK_1f131e15d0fc8d085e3ec830940" FOREIGN KEY ("documentId") REFERENCES "document" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_05b2174451a206cffa7bc477ba2" FOREIGN KEY ("documentCategoryId") REFERENCES "document_category" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("documentId", "documentCategoryId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dcd_documentId" ON "document_category_document" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dcd_documentCategoryId" ON "document_category_document" ("documentCategoryId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_dcd_documentCategoryId"`);
        await queryRunner.query(`DROP INDEX "IDX_dcd_documentId"`);
        await queryRunner.query(`DROP TABLE "document_category_document"`);
        await queryRunner.query(`DROP INDEX "IDX_tag_document_tagId"`);
        await queryRunner.query(`DROP INDEX "IDX_tag_document_documentId"`);
        await queryRunner.query(`DROP TABLE "tag_document"`);
        await queryRunner.query(`DROP INDEX "IDX_document_link_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "IDX_document_link_tenant_org_entity"`);
        await queryRunner.query(`DROP INDEX "IDX_document_link_unique"`);
        await queryRunner.query(`DROP INDEX "IDX_f4ecaf9d1c342a99c1fec89d3f"`);
        await queryRunner.query(`DROP INDEX "IDX_8d11a840d7679532a6b56d21c9"`);
        await queryRunner.query(`DROP INDEX "IDX_f9922d47459cb047bed71f417b"`);
        await queryRunner.query(`DROP INDEX "IDX_01c18a0c7f26203563000fe676"`);
        await queryRunner.query(`DROP INDEX "IDX_7ff4f2a3e7821fc1192cc9b3d9"`);
        await queryRunner.query(`DROP INDEX "IDX_84af04861ef11e778d8cab8862"`);
        await queryRunner.query(`DROP INDEX "IDX_54634b938b40fc98d219872581"`);
        await queryRunner.query(`DROP TABLE "document_link"`);
        await queryRunner.query(`DROP INDEX "IDX_document_share_tenant_org_doc"`);
        await queryRunner.query(`DROP INDEX "IDX_9d4f897f0b1943ebfb89fc6dfe"`);
        await queryRunner.query(`DROP INDEX "IDX_5e6ab4f8f62752db1db1fce8ae"`);
        await queryRunner.query(`DROP INDEX "IDX_9b1eebd6488d856f86bb914376"`);
        await queryRunner.query(`DROP INDEX "IDX_c64e8c2bcf715bea4793a2125f"`);
        await queryRunner.query(`DROP INDEX "IDX_173905c6387fb6a20de352e152"`);
        await queryRunner.query(`DROP INDEX "IDX_454de111ab22e99136418f2c06"`);
        await queryRunner.query(`DROP INDEX "IDX_059308c9e6993694ac857d1a7a"`);
        await queryRunner.query(`DROP INDEX "IDX_02fa2e56f791f1b6ed28f25e59"`);
        await queryRunner.query(`DROP INDEX "IDX_e281f8b0ab90dc09f8adb000bd"`);
        await queryRunner.query(`DROP TABLE "document_share"`);
        await queryRunner.query(`DROP INDEX "IDX_document_version_doc_saved"`);
        await queryRunner.query(`DROP INDEX "IDX_afdd770dac49069d8ff1bf935a"`);
        await queryRunner.query(`DROP INDEX "IDX_81869ef9c3afdc5dbbc80e3d01"`);
        await queryRunner.query(`DROP INDEX "IDX_153fb6d3b13a3af6162322bd3a"`);
        await queryRunner.query(`DROP INDEX "IDX_6fefa36f6b6fe1b6975b753058"`);
        await queryRunner.query(`DROP INDEX "IDX_8df7822a69e7cee233eaff7685"`);
        await queryRunner.query(`DROP INDEX "IDX_5bedca89667b4b5de237df62aa"`);
        await queryRunner.query(`DROP INDEX "IDX_3b72659dc7b4e993a97adbb35f"`);
        await queryRunner.query(`DROP TABLE "document_version"`);
        await queryRunner.query(`DROP INDEX "IDX_document_category_tenant_org_slug"`);
        await queryRunner.query(`DROP INDEX "IDX_24ef316ff7d7353633cdbaabe7"`);
        await queryRunner.query(`DROP INDEX "IDX_fe2878916db7be7161d843151c"`);
        await queryRunner.query(`DROP INDEX "IDX_5b0b8a75ea1ea86d1fa9e2fac9"`);
        await queryRunner.query(`DROP INDEX "IDX_fe4fb219a5b31f44caa0724cc6"`);
        await queryRunner.query(`DROP INDEX "IDX_944bb6d347070ee3f241eef1f7"`);
        await queryRunner.query(`DROP INDEX "IDX_ede572034ada795415af3f29d0"`);
        await queryRunner.query(`DROP INDEX "IDX_3a3aa5fad169bfb9fad21813fc"`);
        await queryRunner.query(`DROP TABLE "document_category"`);
        await queryRunner.query(`DROP INDEX "UQ_document_external_provenance"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_sha256"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_visibility"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_source"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_review"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_knowledge"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_status"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_kind"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_updated"`);
        await queryRunner.query(`DROP INDEX "IDX_document_tenant_org_parent"`);
        await queryRunner.query(`DROP INDEX "IDX_dfcea06c9f090a968a8076dccb"`);
        await queryRunner.query(`DROP INDEX "IDX_d082f1233074e049d2322298b3"`);
        await queryRunner.query(`DROP INDEX "IDX_717bc1a8b39d958af835a5726c"`);
        await queryRunner.query(`DROP INDEX "IDX_a603fd0077a3b0fcaefa6c5d6d"`);
        await queryRunner.query(`DROP INDEX "IDX_1da73b5c7e7cec72b293efd5f8"`);
        await queryRunner.query(`DROP INDEX "IDX_b01d534c51f8b3ada3d197eba5"`);
        await queryRunner.query(`DROP INDEX "IDX_8c3f23b3e8255bb1f8de9e8a8a"`);
        await queryRunner.query(`DROP TABLE "document"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        // document (uuid columns are varchar(36) — keeps composite index keys inside the InnoDB 3072-byte limit)
        await queryRunner.query(`CREATE TABLE \`document\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`kind\` varchar(16) NOT NULL, \`parentId\` varchar(36) NULL, \`index\` int NOT NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`icon\` varchar(255) NULL, \`color\` varchar(32) NULL, \`description\` varchar(500) NULL, \`contentJson\` json NULL, \`contentHtml\` text NULL, \`contentBinary\` longblob NULL, \`isLocked\` tinyint NOT NULL DEFAULT 0, \`storageProvider\` varchar(20) NULL, \`storageKey\` varchar(1024) NULL, \`thumbKey\` varchar(1024) NULL, \`mimeType\` varchar(127) NULL, \`fileSize\` bigint NULL, \`sha256\` char(64) NULL, \`originalFilename\` varchar(255) NULL, \`version\` int NOT NULL DEFAULT 1, \`extractedText\` text NULL, \`extractedTextEdited\` tinyint NOT NULL DEFAULT 0, \`summary\` text NULL, \`status\` varchar(16) NOT NULL DEFAULT 'READY', \`statusMessage\` varchar(500) NULL, \`source\` varchar(16) NOT NULL DEFAULT 'UPLOAD', \`knowledgeStatus\` varchar(16) NOT NULL DEFAULT 'NONE', \`aiConfidence\` double NULL, \`searchable\` tinyint NOT NULL DEFAULT 1, \`reviewStatus\` varchar(16) NOT NULL DEFAULT 'NONE', \`reviewReason\` varchar(32) NULL, \`reviewedById\` varchar(36) NULL, \`reviewedAt\` datetime NULL, \`visibility\` varchar(16) NOT NULL DEFAULT 'ORGANIZATION', \`externalSource\` varchar(64) NULL, \`externalId\` varchar(255) NULL, \`metadata\` json NULL, INDEX \`IDX_8c3f23b3e8255bb1f8de9e8a8a\` (\`createdByUserId\`), INDEX \`IDX_b01d534c51f8b3ada3d197eba5\` (\`updatedByUserId\`), INDEX \`IDX_1da73b5c7e7cec72b293efd5f8\` (\`deletedByUserId\`), INDEX \`IDX_a603fd0077a3b0fcaefa6c5d6d\` (\`isActive\`), INDEX \`IDX_717bc1a8b39d958af835a5726c\` (\`isArchived\`), INDEX \`IDX_d082f1233074e049d2322298b3\` (\`tenantId\`), INDEX \`IDX_dfcea06c9f090a968a8076dccb\` (\`organizationId\`), INDEX \`IDX_document_tenant_org_parent\` (\`tenantId\`, \`organizationId\`, \`parentId\`, \`index\`), INDEX \`IDX_document_tenant_org_updated\` (\`tenantId\`, \`organizationId\`, \`updatedAt\`), INDEX \`IDX_document_tenant_org_kind\` (\`tenantId\`, \`organizationId\`, \`kind\`), INDEX \`IDX_document_tenant_org_status\` (\`tenantId\`, \`organizationId\`, \`status\`), INDEX \`IDX_document_tenant_org_knowledge\` (\`tenantId\`, \`organizationId\`, \`knowledgeStatus\`), INDEX \`IDX_document_tenant_org_review\` (\`tenantId\`, \`organizationId\`, \`reviewStatus\`), INDEX \`IDX_document_tenant_org_source\` (\`tenantId\`, \`organizationId\`, \`source\`), INDEX \`IDX_document_tenant_org_visibility\` (\`tenantId\`, \`organizationId\`, \`visibility\`), INDEX \`IDX_document_tenant_org_sha256\` (\`tenantId\`, \`organizationId\`, \`sha256\`), UNIQUE INDEX \`UQ_document_external_provenance\` (\`tenantId\`, \`organizationId\`, \`externalSource\`, \`externalId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // document_category
        await queryRunner.query(`CREATE TABLE \`document_category\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(100) NOT NULL, \`slug\` varchar(150) NOT NULL, \`color\` varchar(32) NULL, \`icon\` varchar(255) NULL, \`description\` varchar(500) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_3a3aa5fad169bfb9fad21813fc\` (\`createdByUserId\`), INDEX \`IDX_ede572034ada795415af3f29d0\` (\`updatedByUserId\`), INDEX \`IDX_944bb6d347070ee3f241eef1f7\` (\`deletedByUserId\`), INDEX \`IDX_fe4fb219a5b31f44caa0724cc6\` (\`isActive\`), INDEX \`IDX_5b0b8a75ea1ea86d1fa9e2fac9\` (\`isArchived\`), INDEX \`IDX_fe2878916db7be7161d843151c\` (\`tenantId\`), INDEX \`IDX_24ef316ff7d7353633cdbaabe7\` (\`organizationId\`), UNIQUE INDEX \`IDX_document_category_tenant_org_slug\` (\`tenantId\`, \`organizationId\`, \`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // document_version
        await queryRunner.query(`CREATE TABLE \`document_version\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`documentId\` varchar(36) NOT NULL, \`name\` varchar(255) NOT NULL, \`contentJson\` json NULL, \`contentHtml\` text NULL, \`contentBinary\` longblob NULL, \`lastSavedAt\` datetime NOT NULL, \`createdById\` varchar(36) NULL, INDEX \`IDX_3b72659dc7b4e993a97adbb35f\` (\`createdByUserId\`), INDEX \`IDX_5bedca89667b4b5de237df62aa\` (\`updatedByUserId\`), INDEX \`IDX_8df7822a69e7cee233eaff7685\` (\`deletedByUserId\`), INDEX \`IDX_6fefa36f6b6fe1b6975b753058\` (\`isActive\`), INDEX \`IDX_153fb6d3b13a3af6162322bd3a\` (\`isArchived\`), INDEX \`IDX_81869ef9c3afdc5dbbc80e3d01\` (\`tenantId\`), INDEX \`IDX_afdd770dac49069d8ff1bf935a\` (\`organizationId\`), INDEX \`IDX_document_version_doc_saved\` (\`documentId\`, \`lastSavedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // document_share
        await queryRunner.query(`CREATE TABLE \`document_share\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`documentId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NULL, \`teamId\` varchar(36) NULL, \`access\` varchar(16) NOT NULL DEFAULT 'VIEW', INDEX \`IDX_e281f8b0ab90dc09f8adb000bd\` (\`createdByUserId\`), INDEX \`IDX_02fa2e56f791f1b6ed28f25e59\` (\`updatedByUserId\`), INDEX \`IDX_059308c9e6993694ac857d1a7a\` (\`deletedByUserId\`), INDEX \`IDX_454de111ab22e99136418f2c06\` (\`isActive\`), INDEX \`IDX_173905c6387fb6a20de352e152\` (\`isArchived\`), INDEX \`IDX_c64e8c2bcf715bea4793a2125f\` (\`tenantId\`), INDEX \`IDX_9b1eebd6488d856f86bb914376\` (\`organizationId\`), INDEX \`IDX_5e6ab4f8f62752db1db1fce8ae\` (\`employeeId\`), INDEX \`IDX_9d4f897f0b1943ebfb89fc6dfe\` (\`teamId\`), INDEX \`IDX_document_share_tenant_org_doc\` (\`tenantId\`, \`organizationId\`, \`documentId\`), CONSTRAINT \`CHK_document_share_target_xor\` CHECK (((\`employeeId\` IS NULL) <> (\`teamId\` IS NULL))), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // document_link
        await queryRunner.query(`CREATE TABLE \`document_link\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`documentId\` varchar(36) NOT NULL, \`entity\` varchar(50) NOT NULL, \`entityId\` varchar(36) NOT NULL, \`metadata\` json NULL, INDEX \`IDX_54634b938b40fc98d219872581\` (\`createdByUserId\`), INDEX \`IDX_84af04861ef11e778d8cab8862\` (\`updatedByUserId\`), INDEX \`IDX_7ff4f2a3e7821fc1192cc9b3d9\` (\`deletedByUserId\`), INDEX \`IDX_01c18a0c7f26203563000fe676\` (\`isActive\`), INDEX \`IDX_f9922d47459cb047bed71f417b\` (\`isArchived\`), INDEX \`IDX_8d11a840d7679532a6b56d21c9\` (\`tenantId\`), INDEX \`IDX_f4ecaf9d1c342a99c1fec89d3f\` (\`organizationId\`), UNIQUE INDEX \`IDX_document_link_unique\` (\`documentId\`, \`entity\`, \`entityId\`), INDEX \`IDX_document_link_tenant_org_entity\` (\`tenantId\`, \`organizationId\`, \`entity\`, \`entityId\`), INDEX \`IDX_document_link_tenant_org_doc\` (\`tenantId\`, \`organizationId\`, \`documentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        // pivot: tag_document
        await queryRunner.query(`CREATE TABLE \`tag_document\` (\`documentId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_tag_document_documentId\` (\`documentId\`), INDEX \`IDX_tag_document_tagId\` (\`tagId\`), PRIMARY KEY (\`documentId\`, \`tagId\`)) ENGINE=InnoDB`);
        // pivot: document_category_document
        await queryRunner.query(`CREATE TABLE \`document_category_document\` (\`documentId\` varchar(36) NOT NULL, \`documentCategoryId\` varchar(36) NOT NULL, INDEX \`IDX_dcd_documentId\` (\`documentId\`), INDEX \`IDX_dcd_documentCategoryId\` (\`documentCategoryId\`), PRIMARY KEY (\`documentId\`, \`documentCategoryId\`)) ENGINE=InnoDB`);
        // foreign keys: document
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_8c3f23b3e8255bb1f8de9e8a8ae\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_b01d534c51f8b3ada3d197eba5d\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_1da73b5c7e7cec72b293efd5f8f\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_d082f1233074e049d2322298b3d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_dfcea06c9f090a968a8076dccb5\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_4c4ae8a7a98116d84d0ecb087b9\` FOREIGN KEY (\`parentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document\` ADD CONSTRAINT \`FK_8eb97311a105c34bdf58c6a0cfd\` FOREIGN KEY (\`reviewedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        // foreign keys: document_category
        await queryRunner.query(`ALTER TABLE \`document_category\` ADD CONSTRAINT \`FK_3a3aa5fad169bfb9fad21813fca\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_category\` ADD CONSTRAINT \`FK_ede572034ada795415af3f29d04\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_category\` ADD CONSTRAINT \`FK_944bb6d347070ee3f241eef1f7d\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_category\` ADD CONSTRAINT \`FK_fe2878916db7be7161d843151c6\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_category\` ADD CONSTRAINT \`FK_24ef316ff7d7353633cdbaabe75\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        // foreign keys: document_version
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_3b72659dc7b4e993a97adbb35fe\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_5bedca89667b4b5de237df62aa9\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_8df7822a69e7cee233eaff76856\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_81869ef9c3afdc5dbbc80e3d018\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_afdd770dac49069d8ff1bf935aa\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_798ac949e0d25e76695ffc7776a\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_version\` ADD CONSTRAINT \`FK_0a245cd17ebaa45ff65d8a00463\` FOREIGN KEY (\`createdById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        // foreign keys: document_share
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_e281f8b0ab90dc09f8adb000bde\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_02fa2e56f791f1b6ed28f25e594\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_059308c9e6993694ac857d1a7a1\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_c64e8c2bcf715bea4793a2125fd\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_9b1eebd6488d856f86bb9143768\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_77fea374fc99c5934c2eddd25a1\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_5e6ab4f8f62752db1db1fce8aed\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_share\` ADD CONSTRAINT \`FK_9d4f897f0b1943ebfb89fc6dfe3\` FOREIGN KEY (\`teamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: document_link
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_54634b938b40fc98d2198725818\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_84af04861ef11e778d8cab88625\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_7ff4f2a3e7821fc1192cc9b3d98\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_8d11a840d7679532a6b56d21c99\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_f4ecaf9d1c342a99c1fec89d3f8\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_link\` ADD CONSTRAINT \`FK_db2b6843cf6bb119a534d5a7cef\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        // foreign keys: pivots
        await queryRunner.query(`ALTER TABLE \`tag_document\` ADD CONSTRAINT \`FK_05bc0d46914866851710ab20afc\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`tag_document\` ADD CONSTRAINT \`FK_3538faddef46acd460dd845d73c\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_category_document\` ADD CONSTRAINT \`FK_1f131e15d0fc8d085e3ec830940\` FOREIGN KEY (\`documentId\`) REFERENCES \`document\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`document_category_document\` ADD CONSTRAINT \`FK_05b2174451a206cffa7bc477ba2\` FOREIGN KEY (\`documentCategoryId\`) REFERENCES \`document_category\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`document_category_document\` DROP FOREIGN KEY \`FK_05b2174451a206cffa7bc477ba2\``);
        await queryRunner.query(`ALTER TABLE \`document_category_document\` DROP FOREIGN KEY \`FK_1f131e15d0fc8d085e3ec830940\``);
        await queryRunner.query(`ALTER TABLE \`tag_document\` DROP FOREIGN KEY \`FK_3538faddef46acd460dd845d73c\``);
        await queryRunner.query(`ALTER TABLE \`tag_document\` DROP FOREIGN KEY \`FK_05bc0d46914866851710ab20afc\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_db2b6843cf6bb119a534d5a7cef\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_f4ecaf9d1c342a99c1fec89d3f8\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_8d11a840d7679532a6b56d21c99\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_7ff4f2a3e7821fc1192cc9b3d98\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_84af04861ef11e778d8cab88625\``);
        await queryRunner.query(`ALTER TABLE \`document_link\` DROP FOREIGN KEY \`FK_54634b938b40fc98d2198725818\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_9d4f897f0b1943ebfb89fc6dfe3\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_5e6ab4f8f62752db1db1fce8aed\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_77fea374fc99c5934c2eddd25a1\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_9b1eebd6488d856f86bb9143768\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_c64e8c2bcf715bea4793a2125fd\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_059308c9e6993694ac857d1a7a1\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_02fa2e56f791f1b6ed28f25e594\``);
        await queryRunner.query(`ALTER TABLE \`document_share\` DROP FOREIGN KEY \`FK_e281f8b0ab90dc09f8adb000bde\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_0a245cd17ebaa45ff65d8a00463\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_798ac949e0d25e76695ffc7776a\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_afdd770dac49069d8ff1bf935aa\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_81869ef9c3afdc5dbbc80e3d018\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_8df7822a69e7cee233eaff76856\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_5bedca89667b4b5de237df62aa9\``);
        await queryRunner.query(`ALTER TABLE \`document_version\` DROP FOREIGN KEY \`FK_3b72659dc7b4e993a97adbb35fe\``);
        await queryRunner.query(`ALTER TABLE \`document_category\` DROP FOREIGN KEY \`FK_24ef316ff7d7353633cdbaabe75\``);
        await queryRunner.query(`ALTER TABLE \`document_category\` DROP FOREIGN KEY \`FK_fe2878916db7be7161d843151c6\``);
        await queryRunner.query(`ALTER TABLE \`document_category\` DROP FOREIGN KEY \`FK_944bb6d347070ee3f241eef1f7d\``);
        await queryRunner.query(`ALTER TABLE \`document_category\` DROP FOREIGN KEY \`FK_ede572034ada795415af3f29d04\``);
        await queryRunner.query(`ALTER TABLE \`document_category\` DROP FOREIGN KEY \`FK_3a3aa5fad169bfb9fad21813fca\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_8eb97311a105c34bdf58c6a0cfd\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_4c4ae8a7a98116d84d0ecb087b9\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_dfcea06c9f090a968a8076dccb5\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_d082f1233074e049d2322298b3d\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_1da73b5c7e7cec72b293efd5f8f\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_b01d534c51f8b3ada3d197eba5d\``);
        await queryRunner.query(`ALTER TABLE \`document\` DROP FOREIGN KEY \`FK_8c3f23b3e8255bb1f8de9e8a8ae\``);
        await queryRunner.query(`DROP INDEX \`IDX_dcd_documentCategoryId\` ON \`document_category_document\``);
        await queryRunner.query(`DROP INDEX \`IDX_dcd_documentId\` ON \`document_category_document\``);
        await queryRunner.query(`DROP TABLE \`document_category_document\``);
        await queryRunner.query(`DROP INDEX \`IDX_tag_document_tagId\` ON \`tag_document\``);
        await queryRunner.query(`DROP INDEX \`IDX_tag_document_documentId\` ON \`tag_document\``);
        await queryRunner.query(`DROP TABLE \`tag_document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_link_tenant_org_doc\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_link_tenant_org_entity\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_link_unique\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_f4ecaf9d1c342a99c1fec89d3f\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_8d11a840d7679532a6b56d21c9\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_f9922d47459cb047bed71f417b\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_01c18a0c7f26203563000fe676\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_7ff4f2a3e7821fc1192cc9b3d9\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_84af04861ef11e778d8cab8862\` ON \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_54634b938b40fc98d219872581\` ON \`document_link\``);
        await queryRunner.query(`DROP TABLE \`document_link\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_share_tenant_org_doc\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_9d4f897f0b1943ebfb89fc6dfe\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_5e6ab4f8f62752db1db1fce8ae\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_9b1eebd6488d856f86bb914376\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_c64e8c2bcf715bea4793a2125f\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_173905c6387fb6a20de352e152\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_454de111ab22e99136418f2c06\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_059308c9e6993694ac857d1a7a\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_02fa2e56f791f1b6ed28f25e59\` ON \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_e281f8b0ab90dc09f8adb000bd\` ON \`document_share\``);
        await queryRunner.query(`DROP TABLE \`document_share\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_version_doc_saved\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_afdd770dac49069d8ff1bf935a\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_81869ef9c3afdc5dbbc80e3d01\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_153fb6d3b13a3af6162322bd3a\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_6fefa36f6b6fe1b6975b753058\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_8df7822a69e7cee233eaff7685\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_5bedca89667b4b5de237df62aa\` ON \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_3b72659dc7b4e993a97adbb35f\` ON \`document_version\``);
        await queryRunner.query(`DROP TABLE \`document_version\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_category_tenant_org_slug\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_24ef316ff7d7353633cdbaabe7\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_fe2878916db7be7161d843151c\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_5b0b8a75ea1ea86d1fa9e2fac9\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_fe4fb219a5b31f44caa0724cc6\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_944bb6d347070ee3f241eef1f7\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_ede572034ada795415af3f29d0\` ON \`document_category\``);
        await queryRunner.query(`DROP INDEX \`IDX_3a3aa5fad169bfb9fad21813fc\` ON \`document_category\``);
        await queryRunner.query(`DROP TABLE \`document_category\``);
        await queryRunner.query(`DROP INDEX \`UQ_document_external_provenance\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_sha256\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_visibility\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_source\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_review\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_knowledge\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_status\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_kind\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_updated\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_document_tenant_org_parent\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_dfcea06c9f090a968a8076dccb\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_d082f1233074e049d2322298b3\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_717bc1a8b39d958af835a5726c\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_a603fd0077a3b0fcaefa6c5d6d\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_1da73b5c7e7cec72b293efd5f8\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_b01d534c51f8b3ada3d197eba5\` ON \`document\``);
        await queryRunner.query(`DROP INDEX \`IDX_8c3f23b3e8255bb1f8de9e8a8a\` ON \`document\``);
        await queryRunner.query(`DROP TABLE \`document\``);
    }
}
