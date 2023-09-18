
import { MigrationInterface, QueryRunner } from "typeorm";
import { IntegrationsUtils } from "./../../integration/utils";
import { DEFAULT_INTEGRATIONS, PROJECT_MANAGE_DEFAULT_INTEGRATIONS } from "./../../integration/default-integration";

/**
 *
 */
export class SeedProjectManagementIntegrations1695043020330 implements MigrationInterface {

    name = 'SeedProjectManagementIntegrations1695043020330';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        await IntegrationsUtils.upsertIntegrationsAndIntegrationTypes(queryRunner, PROJECT_MANAGE_DEFAULT_INTEGRATIONS);
        await IntegrationsUtils.upsertIntegrationsAndIntegrationTypes(queryRunner, DEFAULT_INTEGRATIONS);
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> { }
}
