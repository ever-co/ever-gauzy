import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/**
 * Grants `CUSTOM_SMTP_EDIT` to every role that holds `CUSTOM_SMTP_VIEW` today, tenant by tenant.
 *
 * Until this change the custom-SMTP family had one grant, `CUSTOM_SMTP_VIEW`, and every route of `/api/smtp` ran
 * under it — the creation and the edit as much as the reads. Owner decision 5 (2026-10-13) makes the
 * soft-delete/recover pair require the controller's own edit grant, which needed one to exist, so the writes now
 * require `CUSTOM_SMTP_EDIT`. A role that saves SMTP settings today does so under the read grant; without this
 * migration it would be refused the moment the new code runs, because a `role_permission` row is per-tenant data
 * that only a seed (at provisioning) or a migration (afterwards) writes.
 *
 * **Who gets it: exactly the live holders of the read grant.** "Holds" is the predicate
 * `RolePermissionService.checkRolePermission` applies — enabled, active, not archived, not soft-deleted — so a
 * role whose read grant is switched off, archived or deleted gains nothing, and a role that already has a
 * `CUSTOM_SMTP_EDIT` row (whatever its state) is left exactly as its tenant left it. It only INSERTS: no existing
 * row is changed or removed, and running it again inserts nothing.
 *
 * New tenants get the grant from `DEFAULT_ROLE_PERMISSIONS` (SUPER_ADMIN and ADMIN, the read grant's holders).
 */
export class GrantCustomSmtpEditPermission1791000000573 implements MigrationInterface {
	name = 'GrantCustomSmtpEditPermission1791000000573';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		let truthy: string;
		let falsy: string;

		switch (dbType) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.mysql:
				truthy = '1';
				falsy = '0';
				break;
			case DatabaseTypeEnum.postgres:
				truthy = 'true';
				falsy = 'false';
				break;
			default:
				throw Error(`Unsupported database: ${dbType}`);
		}

		const holders: Array<{ tenantId: string; roleId: string }> = await queryRunner.query(
			replacePlaceholders(
				p(
					`SELECT DISTINCT "held"."tenantId", "held"."roleId"
					FROM "role_permission" "held"
					WHERE "held"."permission" = $1
						AND "held"."enabled" = ${truthy}
						AND "held"."isActive" = ${truthy}
						AND "held"."isArchived" = ${falsy}
						AND "held"."deletedAt" IS NULL
						AND "held"."tenantId" IS NOT NULL
						AND NOT EXISTS (
							SELECT 1 FROM "role_permission" "granted"
							WHERE "granted"."tenantId" = "held"."tenantId"
								AND "granted"."roleId" = "held"."roleId"
								AND "granted"."permission" = $2
						)`
				),
				dbType
			),
			[PermissionsEnum.CUSTOM_SMTP_VIEW, PermissionsEnum.CUSTOM_SMTP_EDIT]
		);

		for (const { tenantId, roleId } of holders) {
			if (dbType === DatabaseTypeEnum.postgres) {
				await queryRunner.query(
					p(`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, true)`),
					[tenantId, roleId, PermissionsEnum.CUSTOM_SMTP_EDIT]
				);
			} else {
				await queryRunner.query(
					replacePlaceholders(
						p(
							`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, $4, 1)`
						),
						dbType
					),
					[uuidV4(), tenantId, roleId, PermissionsEnum.CUSTOM_SMTP_EDIT]
				);
			}
		}

		console.log(chalk.green(`${this.name}: granted ${PermissionsEnum.CUSTOM_SMTP_EDIT} to ${holders.length} role(s).`));
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: a `CUSTOM_SMTP_EDIT` row may have been
	 * switched off, switched back on or granted to another role by a tenant administrator since this ran, and the
	 * rows are inert without the code that reads them. Rolling the code back is what takes the grant out of use.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
