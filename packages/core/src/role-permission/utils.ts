import { QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';

/**
 * Role permissions utils functions.
 */
export class RolePermissionUtils {
	public static async migrateRolePermissions(queryRunner: QueryRunner): Promise<void> {
		/** Removed below permissions for all users in DEMO mode  */
		const exceptPermissions = [PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA];
		/**
		 * GET all tenants in the system
		 */
		const tenants = await queryRunner.connection.manager.query(`SELECT * FROM tenant`);
		for await (const tenant of tenants) {
			/**
			 * GET all roles for specific tenant
			 */
			const tenantId = tenant.id;
			const query = `SELECT * FROM "role" WHERE "role"."tenantId" = $1`;
			const roles = await queryRunner.connection.manager.query(query, [tenantId]);

			for await (const role of roles) {
				const permissions = Object.values(PermissionsEnum).filter((permission: PermissionsEnum) =>
					environment.demo ? !exceptPermissions.includes(permission) : true
				);
				const { role: roleEnum, defaultEnabledPermissions = [] } = DEFAULT_ROLE_PERMISSIONS.find(
					(defaultRole) => role.name === defaultRole.role
				);
				for await (const permission of permissions) {
					/**
					 * Find role permissions already exist or not
					 */
					const query = `
                        SELECT DISTINCT
                            "distinctAlias"."role_permission_id"
                        FROM (
                            SELECT
                                "role_permission"."id" AS "role_permission_id",
                                "role_permission"."tenantId" AS "role_permission_tenantId",
                                "role_permission"."permission" AS "role_permission_permission",
                                "role_permission"."roleId" AS "role_permission_roleId"
                            FROM
                                "role_permission" "role_permission"
                            INNER JOIN "role" "role"
                                ON "role"."id"="role_permission"."roleId"
                            WHERE (
                                "role_permission"."tenantId" = $1 AND
                                "role_permission"."permission" = $2 AND
                                "role"."tenantId" = $3 AND
                                "role"."name" = $4
                            )
                        )
                        "distinctAlias" ORDER BY "role_permission_id" ASC LIMIT 1
                    `;
					const existed = await queryRunner.connection.manager.query(query, [
						tenantId,
						permission,
						tenantId,
						roleEnum
					]);
					if (isEmpty(existed) && role) {
						console.log(
							chalk.magenta(
								`${moment().format(
									'DD.MM.YYYY HH:mm:ss'
								)} unlocked missing permission for the tenant: ${tenant.name}`,
								roleEnum,
								permission
							)
						);
						/**
						 * Missing role permission payload for insert into database
						 */
						const { id: roleId } = role;
						const payload = [tenantId, roleId, permission, defaultEnabledPermissions.includes(permission)];
						console.log(
							chalk.magenta([
								tenantId,
								roleId,
								permission,
								defaultEnabledPermissions.includes(permission)
							])
						);
						/**
						 * SqliteDB Query Runner
						 *
						 * @param queryRunner
						 */
						if (queryRunner.connection.options.type === 'sqlite') {
							payload.push(uuidV4());
							const query = `INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled", "id") VALUES ($1, $2, $3, $4, $5)`;
							await queryRunner.connection.manager.query(query, payload);
						} else {
							const query = `INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES($1, $2, $3, $4)`;
							await queryRunner.connection.manager.query(query, payload);
						}
					}
				}
			}
		}
	}
}
