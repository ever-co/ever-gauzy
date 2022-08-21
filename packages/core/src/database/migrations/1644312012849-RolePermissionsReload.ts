import { MigrationInterface, QueryRunner } from "typeorm";
import { reloadRolePermissions } from "./../../role-permission/role-permission.seed";

export class RolePermissionsReload1644312012849 implements MigrationInterface {

    name = 'RolePermissionsReload1644312012849';

    public async up(queryRunner: QueryRunner): Promise<any> {
        await reloadRolePermissions(queryRunner.connection);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}