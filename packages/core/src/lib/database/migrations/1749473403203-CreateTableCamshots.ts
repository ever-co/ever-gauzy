import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTableCamshots1749473403203 implements MigrationInterface {
    name = 'CreateTableCamshots1749473403203';

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
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`CREATE TYPE "public"."camshots_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`CREATE TABLE "camshots" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "title" character varying NOT NULL, "fileKey" character varying NOT NULL, "thumbKey" character varying, "storageProvider" "public"."camshots_storageprovider_enum", "recordedAt" TIMESTAMP, "fullUrl" character varying, "thumbUrl" character varying, "size" integer, "timeSlotId" uuid, "uploadedById" uuid, "userId" uuid, CONSTRAINT "PK_f7b6bc04508c1e679726354f081" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b534f6f40427fa2e210503b42f" ON "camshots" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd93e672c80ffb5ce5975ca534" ON "camshots" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_20a696a4ed9efc63b759988ab9" ON "camshots" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec9c18c82b455f9a5c1c429980" ON "camshots" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_49cb91250cb9427c775abd8572" ON "camshots" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_ec581c527298029aa27b72b7dd" ON "camshots" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cad3841ce55a5903aa44d6d63d" ON "camshots" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_296c55d1f3203f65af3a8313a1" ON "camshots" ("storageProvider") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ceaa21268b767159b202e3e51" ON "camshots" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_b2b4988100343a2ee1e5dc10b2" ON "camshots" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9055d166843ea7dc55234a9807" ON "camshots" ("uploadedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_c8001dc9eda72fe5d23031cfba" ON "camshots" ("userId") `);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_b534f6f40427fa2e210503b42f3" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_cd93e672c80ffb5ce5975ca534a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_20a696a4ed9efc63b759988ab96" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_ec581c527298029aa27b72b7ddc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_cad3841ce55a5903aa44d6d63d3" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_b2b4988100343a2ee1e5dc10b22" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_9055d166843ea7dc55234a98073" FOREIGN KEY ("uploadedById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "camshots" ADD CONSTRAINT "FK_c8001dc9eda72fe5d23031cfba5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_c8001dc9eda72fe5d23031cfba5"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_9055d166843ea7dc55234a98073"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_b2b4988100343a2ee1e5dc10b22"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_cad3841ce55a5903aa44d6d63d3"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_ec581c527298029aa27b72b7ddc"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_20a696a4ed9efc63b759988ab96"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_cd93e672c80ffb5ce5975ca534a"`);
        await queryRunner.query(`ALTER TABLE "camshots" DROP CONSTRAINT "FK_b534f6f40427fa2e210503b42f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8001dc9eda72fe5d23031cfba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9055d166843ea7dc55234a9807"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2b4988100343a2ee1e5dc10b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ceaa21268b767159b202e3e51"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_296c55d1f3203f65af3a8313a1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cad3841ce55a5903aa44d6d63d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec581c527298029aa27b72b7dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49cb91250cb9427c775abd8572"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec9c18c82b455f9a5c1c429980"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20a696a4ed9efc63b759988ab9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd93e672c80ffb5ce5975ca534"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b534f6f40427fa2e210503b42f"`);
        await queryRunner.query(`DROP TABLE "camshots"`);
        await queryRunner.query(`DROP TYPE "public"."camshots_storageprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
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
