import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmployeeTable1666007548644 implements MigrationInterface {

    name = 'AlterEmployeeTable1666007548644';

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
        await queryRunner.query(`ALTER TABLE "organization_department_employee" DROP CONSTRAINT "FK_0d4f83695591ae3c98a0544ac8d"`);
        await queryRunner.query(`ALTER TABLE "organization_department_employee" ADD CONSTRAINT "FK_0d4f83695591ae3c98a0544ac8d" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_department_employee" DROP CONSTRAINT "FK_0d4f83695591ae3c98a0544ac8d"`);
        await queryRunner.query(`ALTER TABLE "organization_department_employee" ADD CONSTRAINT  "FK_0d4f83695591ae3c98a0544ac8d" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0d4f83695591ae3c98a0544ac8"`);
        await queryRunner.query(`DROP INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_department_employee" ("organizationDepartmentId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_c34e79a3aa682bbd3f0e8cf4c46" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_department_employee"("organizationDepartmentId", "employeeId") SELECT "organizationDepartmentId", "employeeId" FROM "organization_department_employee"`);
        await queryRunner.query(`DROP TABLE "organization_department_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_department_employee" RENAME TO "organization_department_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_0d4f83695591ae3c98a0544ac8" ON "organization_department_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4" ON "organization_department_employee" ("organizationDepartmentId") `);
        await queryRunner.query(`DROP INDEX "IDX_0d4f83695591ae3c98a0544ac8"`);
        await queryRunner.query(`DROP INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_department_employee" ("organizationDepartmentId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_c34e79a3aa682bbd3f0e8cf4c46" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0d4f83695591ae3c98a0544ac8d" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_organization_department_employee"("organizationDepartmentId", "employeeId") SELECT "organizationDepartmentId", "employeeId" FROM "organization_department_employee"`);
        await queryRunner.query(`DROP TABLE "organization_department_employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_department_employee" RENAME TO "organization_department_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_0d4f83695591ae3c98a0544ac8" ON "organization_department_employee" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4" ON "organization_department_employee" ("organizationDepartmentId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4"`);
        await queryRunner.query(`DROP INDEX "IDX_0d4f83695591ae3c98a0544ac8"`);
        await queryRunner.query(`ALTER TABLE "organization_department_employee" RENAME TO "temporary_organization_department_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_department_employee" ("organizationDepartmentId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_c34e79a3aa682bbd3f0e8cf4c46" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "organization_department_employee"("organizationDepartmentId", "employeeId") SELECT "organizationDepartmentId", "employeeId" FROM "temporary_organization_department_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_department_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4" ON "organization_department_employee" ("organizationDepartmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d4f83695591ae3c98a0544ac8" ON "organization_department_employee" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4"`);
        await queryRunner.query(`DROP INDEX "IDX_0d4f83695591ae3c98a0544ac8"`);
        await queryRunner.query(`ALTER TABLE "organization_department_employee" RENAME TO "temporary_organization_department_employee"`);
        await queryRunner.query(`CREATE TABLE "organization_department_employee" ("organizationDepartmentId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_0d4f83695591ae3c98a0544ac8d" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_c34e79a3aa682bbd3f0e8cf4c46" FOREIGN KEY ("organizationDepartmentId") REFERENCES "organization_department" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationDepartmentId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "organization_department_employee"("organizationDepartmentId", "employeeId") SELECT "organizationDepartmentId", "employeeId" FROM "temporary_organization_department_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_department_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_c34e79a3aa682bbd3f0e8cf4c4" ON "organization_department_employee" ("organizationDepartmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d4f83695591ae3c98a0544ac8" ON "organization_department_employee" ("employeeId") `);
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
