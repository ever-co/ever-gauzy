import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidV4 } from 'uuid';
    
export class AlterChangelogTable1650704972412 implements MigrationInterface {

    name = 'AlterChangelogTable1650704972412';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
        await this._seedChangeLogFeatures(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteDownQueryRunner(queryRunner);
        } else {
            await this.postgresDownQueryRunner(queryRunner);
        }
    }

    /**
    * PostgresDB Up Migration
    * 
    * @param queryRunner 
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "changelog" ADD "isFeature" boolean`);
        await queryRunner.query(`ALTER TABLE "changelog" ADD "imageUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "changelog" ALTER COLUMN "learnMoreUrl" DROP NOT NULL`);
    }

    /**
    * PostgresDB Down Migration
    * 
    * @param queryRunner 
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "changelog" ALTER COLUMN "learnMoreUrl" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "imageUrl"`);
        await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "isFeature"`);
    }
    
    /**
     * SqliteDB Up Migration
     * 
     * @param queryRunner 
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`CREATE TABLE "temporary_changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "changelog"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
        await queryRunner.query(`ALTER TABLE "temporary_changelog" RENAME TO "changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`CREATE TABLE "temporary_changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl" FROM "changelog"`);
        await queryRunner.query(`DROP TABLE "changelog"`);
        await queryRunner.query(`ALTER TABLE "temporary_changelog" RENAME TO "changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
    }
    
    /**
     * SqliteDB Down Migration
     * 
     * @param queryRunner 
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`ALTER TABLE "changelog" RENAME TO "temporary_changelog"`);
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, "isFeature" boolean, "imageUrl" varchar, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl", "isFeature", "imageUrl" FROM "temporary_changelog"`);
        await queryRunner.query(`DROP TABLE "temporary_changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_744268ee0ec6073883267bc3b6"`);
        await queryRunner.query(`DROP INDEX "IDX_c2037b621d2e8023898aee4ac7"`);
        await queryRunner.query(`ALTER TABLE "changelog" RENAME TO "temporary_changelog"`);
        await queryRunner.query(`CREATE TABLE "changelog" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "icon" varchar, "title" varchar, "date" datetime NOT NULL, "content" varchar NOT NULL, "learnMoreUrl" varchar NOT NULL, CONSTRAINT "FK_c2037b621d2e8023898aee4ac74" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_744268ee0ec6073883267bc3b66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "changelog"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "icon", "title", "date", "content", "learnMoreUrl" FROM "temporary_changelog"`);
        await queryRunner.query(`DROP TABLE "temporary_changelog"`);
        await queryRunner.query(`CREATE INDEX "IDX_744268ee0ec6073883267bc3b6" ON "changelog" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2037b621d2e8023898aee4ac7" ON "changelog" ("organizationId") `);
    }

    /**
     * This seeder should be run for production environment only
     * 
     * @param queryRunner 
     */
    private async _seedChangeLogFeatures(queryRunner: QueryRunner) {
        const features = [
            {
                icon: 'cube-outline',
                title: 'New CRM',
                date: new Date(),
                isFeature: true,
                content: 'Now you can read latest features changelog directly in Gauzy',
                learnMoreUrl: '',
                imageUrl: 'assets/images/features/macbook-2.png'
            },
            {
                icon: 'globe-outline',
                title: 'Most popular in 20 countries',
                date: new Date(),
                isFeature: true,
                content: 'Europe, Americas and Asia get choise',
                learnMoreUrl: '',
                imageUrl: 'assets/images/features/macbook-1.png'
            },
            {
                icon: 'flash-outline',
                title: 'Visit our website',
                date: new Date(),
                isFeature: true,
                content: 'You are welcome to check more information about the platform at our official website.',
                learnMoreUrl: '',
                imageUrl: ''
            }
        ];

        try {
            for await (const feature of features) {
                const payload = Object.values(feature);
                if (queryRunner.connection.options.type === 'sqlite') {
                    payload.push(uuidV4());
                    await queryRunner.connection.manager.query(`
                        INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl", "id") VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
                        payload
                    );
                } else {
                    await queryRunner.connection.manager.query(`
                        INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl") VALUES($1, $2, $3, $4, $5, $6, $7)`,
                        payload
                    );
                }
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while insert changelog changes in production server', error);
        }
    }
}