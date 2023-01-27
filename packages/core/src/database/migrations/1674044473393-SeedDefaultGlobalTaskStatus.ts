
import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidV4 } from 'uuid';
import { DEFAULT_GLOBAL_STATUSES } from "./../../tasks/statuses/default-global-statuses";

export class SeedDefaultGlobalTaskStatus1674044473393 implements MigrationInterface {

    name = 'SeedDefaultGlobalTaskStatus1674044473393';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        try {
            for await (const status of DEFAULT_GLOBAL_STATUSES) {
                const payload = Object.values(status);
                if (queryRunner.connection.options.type === 'sqlite') {
                    payload.push(uuidV4());
                    const query = `INSERT INTO "status" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES($1, $2, $3, $4, $5, $6, $7)`;
                    await queryRunner.connection.manager.query(query, payload);
                } else {
                    const query = `INSERT INTO "status" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
                    await queryRunner.connection.manager.query(query, payload);
                }
            }
        } catch (error) {
            // since we have errors let's rollback changes we made
            console.log('Error while insert default global task statuses in production server', error);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {}
}
