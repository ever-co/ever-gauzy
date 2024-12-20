import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterCandidateTable1672211594766 implements MigrationInterface {

    name = 'AlterCandidateTable1672211594766';

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
        await queryRunner.query(`ALTER TABLE "candidate_department" DROP CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61"`);
        await queryRunner.query(`ALTER TABLE "candidate_department" ADD CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61" FOREIGN KEY ("candidateId") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "candidate_department" DROP CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61"`);
        await queryRunner.query(`ALTER TABLE "candidate_department" ADD CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61" FOREIGN KEY ("candidateId") REFERENCES "candidate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6"`);
        await queryRunner.query(`DROP INDEX "IDX_c58533f9ba63f42fef682e1ee7"`);
        await queryRunner.query(`CREATE TABLE "temporary_candidate_department" ("organizationDepartmentId" varchar NOT NULL, "candidateId" varchar NOT NULL, CONSTRAINT "FK_c58533f9ba63f42fef682e1ee7c" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "candidateId"))`);
        await queryRunner.query(`INSERT INTO "temporary_candidate_department"("organizationDepartmentId", "candidateId") SELECT "organizationDepartmentId", "candidateId" FROM "candidate_department"`);
        await queryRunner.query(`DROP TABLE "candidate_department"`);
        await queryRunner.query(`ALTER TABLE "temporary_candidate_department" RENAME TO "candidate_department"`);
        await queryRunner.query(`CREATE INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6" ON "candidate_department" ("candidateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c58533f9ba63f42fef682e1ee7" ON "candidate_department" ("organizationDepartmentId") `);
        await queryRunner.query(`DROP INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6"`);
        await queryRunner.query(`DROP INDEX "IDX_c58533f9ba63f42fef682e1ee7"`);
        await queryRunner.query(`CREATE TABLE "temporary_candidate_department" ("organizationDepartmentId" varchar NOT NULL, "candidateId" varchar NOT NULL, CONSTRAINT "FK_c58533f9ba63f42fef682e1ee7c" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "candidateId"))`);
        await queryRunner.query(`INSERT INTO "temporary_candidate_department"("organizationDepartmentId", "candidateId") SELECT "organizationDepartmentId", "candidateId" FROM "candidate_department"`);
        await queryRunner.query(`DROP TABLE "candidate_department"`);
        await queryRunner.query(`ALTER TABLE "temporary_candidate_department" RENAME TO "candidate_department"`);
        await queryRunner.query(`CREATE INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6" ON "candidate_department" ("candidateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c58533f9ba63f42fef682e1ee7" ON "candidate_department" ("organizationDepartmentId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c58533f9ba63f42fef682e1ee7"`);
        await queryRunner.query(`DROP INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6"`);
        await queryRunner.query(`ALTER TABLE "candidate_department" RENAME TO "temporary_candidate_department"`);
        await queryRunner.query(`CREATE TABLE "candidate_department" ("organizationDepartmentId" varchar NOT NULL, "candidateId" varchar NOT NULL, CONSTRAINT "FK_c58533f9ba63f42fef682e1ee7c" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "candidateId"))`);
        await queryRunner.query(`INSERT INTO "candidate_department"("organizationDepartmentId", "candidateId") SELECT "organizationDepartmentId", "candidateId" FROM "temporary_candidate_department"`);
        await queryRunner.query(`DROP TABLE "temporary_candidate_department"`);
        await queryRunner.query(`CREATE INDEX "IDX_c58533f9ba63f42fef682e1ee7" ON "candidate_department" ("organizationDepartmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6" ON "candidate_department" ("candidateId") `);
        await queryRunner.query(`DROP INDEX "IDX_c58533f9ba63f42fef682e1ee7"`);
        await queryRunner.query(`DROP INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6"`);
        await queryRunner.query(`ALTER TABLE "candidate_department" RENAME TO "temporary_candidate_department"`);
        await queryRunner.query(`CREATE TABLE "candidate_department" ("organizationDepartmentId" varchar NOT NULL, "candidateId" varchar NOT NULL, CONSTRAINT "FK_ef6e8d34b95dcb2b21d5de08a61" FOREIGN KEY ("candidateId") REFERENCES "candidate" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_c58533f9ba63f42fef682e1ee7c" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "candidateId"))`);
        await queryRunner.query(`INSERT INTO "candidate_department"("organizationDepartmentId", "candidateId") SELECT "organizationDepartmentId", "candidateId" FROM "temporary_candidate_department"`);
        await queryRunner.query(`DROP TABLE "temporary_candidate_department"`);
        await queryRunner.query(`CREATE INDEX "IDX_c58533f9ba63f42fef682e1ee7" ON "candidate_department" ("organizationDepartmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ef6e8d34b95dcb2b21d5de08a6" ON "candidate_department" ("candidateId") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
    }
}
