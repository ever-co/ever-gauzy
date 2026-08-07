import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { FeatureEnum } from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';

export class SeedDocumentsFeature1790000004000 implements MigrationInterface {
    name = 'SeedDocumentsFeature1790000004000';

    /**
     * The `FEATURE_DOCUMENTS` catalog row, mirroring its `DEFAULT_FEATURES` entry
     * (packages/core/src/lib/feature/default-features.ts). Fresh installs get the row
     * from the normal `feature.seed.ts` path; this migration inserts it (guarded, so it
     * is idempotent) for already-seeded deployments. Per-org `feature_organization`
     * toggle rows are created lazily by the platform, not by this migration.
     */
    private readonly feature = {
        name: 'Documents',
        code: FeatureEnum.FEATURE_DOCUMENTS,
        description: 'Central hub for company documents: uploads, wiki pages, review, and AI knowledge',
        image: 'documents.png',
        link: 'pages/documents',
        status: 'info',
        icon: 'fas fa-book'
    };

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
     * Removes the seeded `FEATURE_DOCUMENTS` row (and its per-org toggle rows).
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' reverting changes!'));

        switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
            case DatabaseTypeEnum.sqlite:
            case DatabaseTypeEnum.betterSqlite3:
                await queryRunner.query(
                    `DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = ?)`,
                    [this.feature.code]
                );
                await queryRunner.query(`DELETE FROM "feature" WHERE "code" = ?`, [this.feature.code]);
                break;
            case DatabaseTypeEnum.postgres:
                await queryRunner.query(
                    `DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = $1)`,
                    [this.feature.code]
                );
                await queryRunner.query(`DELETE FROM "feature" WHERE "code" = $1`, [this.feature.code]);
                break;
            case DatabaseTypeEnum.mysql:
                await queryRunner.query(
                    `DELETE FROM \`feature_organization\` WHERE \`featureId\` IN (SELECT \`id\` FROM \`feature\` WHERE \`code\` = ?)`,
                    [this.feature.code]
                );
                await queryRunner.query(`DELETE FROM \`feature\` WHERE \`code\` = ?`, [this.feature.code]);
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
        const { name, code, description, image, link, status, icon } = this.feature;
        await queryRunner.query(
            `INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
             SELECT gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
             WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = $2)`,
            [name, code, description, image, link, status, icon]
        );
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        const { name, code, description, image, link, status, icon } = this.feature;
        await queryRunner.query(
            `INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
             SELECT ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = ?)`,
            [uuidv4(), name, code, description, image, link, status, icon, code]
        );
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        const { name, code, description, image, link, status, icon } = this.feature;
        await queryRunner.query(
            `INSERT INTO \`feature\` (\`id\`, \`name\`, \`code\`, \`description\`, \`image\`, \`link\`, \`status\`, \`icon\`)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?
             FROM DUAL
             WHERE NOT EXISTS (SELECT 1 FROM \`feature\` WHERE \`code\` = ?)`,
            [uuidv4(), name, code, description, image, link, status, icon, code]
        );
    }
}
