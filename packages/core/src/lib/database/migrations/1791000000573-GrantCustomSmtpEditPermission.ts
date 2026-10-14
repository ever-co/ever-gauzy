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
 * role whose read grant is switched off, archived or deleted gains nothing. A holder with no `CUSTOM_SMTP_EDIT` row
 * gets one, switched on; a holder whose row a permission reload wrote switched off earlier in the same upgrade has it
 * switched on (see the note in `up()`); a row a person created, changed or deleted is left exactly as its tenant
 * left it. Nothing is removed, and running it again changes nothing.
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

		const run = (sql: string, parameters: unknown[] = []) =>
			queryRunner.query(replacePlaceholders(p(sql), dbType), parameters);

		// The live holders of the read grant, by tenant and role.
		const holders: Array<{ tenantId: string; roleId: string }> = await run(
			`SELECT DISTINCT "held"."tenantId", "held"."roleId"
			FROM "role_permission" "held"
			WHERE "held"."permission" = $1
				AND "held"."enabled" = ${truthy}
				AND "held"."isActive" = ${truthy}
				AND "held"."isArchived" = ${falsy}
				AND "held"."deletedAt" IS NULL
				AND "held"."tenantId" IS NOT NULL`,
			[PermissionsEnum.CUSTOM_SMTP_VIEW]
		);

		// Every write-grant row that already exists. Read once, decided in code: MySQL refuses an UPDATE whose
		// subquery reads the table being updated, so the rows to switch on are named by id instead.
		const existing: Array<{
			id: string;
			tenantId: string;
			roleId: string;
			enabled: boolean | number;
			createdByUserId: string | null;
			updatedByUserId: string | null;
			deletedAt: string | Date | null;
		}> = await run(
			`SELECT "id", "tenantId", "roleId", "enabled", "createdByUserId", "updatedByUserId", "deletedAt"
			FROM "role_permission" WHERE "permission" = $1`,
			[PermissionsEnum.CUSTOM_SMTP_EDIT]
		);
		const byHolder = new Map(existing.map((row) => [`${row.tenantId}|${row.roleId}`, row]));

		let inserted = 0;
		let enabled = 0;

		for (const { tenantId, roleId } of holders) {
			const row = byHolder.get(`${tenantId}|${roleId}`);

			if (!row) {
				if (dbType === DatabaseTypeEnum.postgres) {
					await run(
						`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, true)`,
						[tenantId, roleId, PermissionsEnum.CUSTOM_SMTP_EDIT]
					);
				} else {
					await run(
						`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, $4, 1)`,
						[uuidV4(), tenantId, roleId, PermissionsEnum.CUSTOM_SMTP_EDIT]
					);
				}
				inserted++;
				continue;
			}

			// A row that exists already is left as it is — unless nobody decided it. The permission-reload
			// migrations (`RolePermissionUtils.migrateRolePermissions`) insert every permission value a role lacks,
			// switched on only for the role's defaults, and they run with the code being deployed: on an upgrade where
			// one of them runs before this migration, every tenant-granted reader of SMTP settings gets a SWITCHED-OFF
			// write-grant row first, and skipping it would lock that role out of saving. Such a row was written by a
			// migration, so it carries no user — no `createdByUserId`, no `updatedByUserId` (the entity subscriber
			// stamps both from the request) — and is live. A row a person created or changed carries their id, and a
			// deleted row was deleted by someone; both are a tenant's decision and stay exactly as they are.
			const isOff = row.enabled === false || Number(row.enabled) === 0;
			const unattributed = !row.createdByUserId && !row.updatedByUserId && !row.deletedAt;
			if (isOff && unattributed) {
				await run(`UPDATE "role_permission" SET "enabled" = ${truthy} WHERE "id" = $1`, [row.id]);
				enabled++;
			}
		}

		console.log(
			chalk.green(
				`${this.name}: ${PermissionsEnum.CUSTOM_SMTP_EDIT} inserted for ${inserted} role(s) and switched on for ${enabled} role(s) a reload had written it switched off for.`
			)
		);
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
