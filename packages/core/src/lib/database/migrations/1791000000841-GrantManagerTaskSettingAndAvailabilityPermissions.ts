import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The grants the `MANAGER` role gets in every existing tenant (owner decision 2(b), 2026-10-23). */
export const MANAGER_TASK_SETTING_AND_AVAILABILITY_GRANTS: readonly PermissionsEnum[] = [
	PermissionsEnum.ORG_TASK_SETTING,
	PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE,
	PermissionsEnum.EMPLOYEE_AVAILABILITY_READ,
	PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE,
	PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE
];
export const MANAGER_TASK_SETTING_AND_AVAILABILITY_ROLES: readonly RolesEnum[] = [RolesEnum.MANAGER];

/**
 * Grants `ORG_TASK_SETTING` and `EMPLOYEE_AVAILABILITY_CREATE`, `_READ`, `_UPDATE` and `_DELETE` to the `MANAGER`
 * role of every tenant (the owner's answer names `EMPLOYEE_AVAILABILITY_*`, so the read comes with the writes).
 *
 * The task-setting writes (ever-co/ever-gauzy#11329) and the availability-slot, appointment and appointment-invitation
 * writes (ever-co/ever-gauzy#11321) wrote with no permission at all (GHSA-v79w-54p2-wmh5) and now state these grants.
 * `MANAGER` held none of them by default, so managers lost writes they had. Owner decision 2(b) (2026-10-23) gives
 * them back to `MANAGER`. `DEFAULT_ROLE_PERMISSIONS` lists the same grants for a new tenant. A `role_permission` row is
 * per-tenant data that only a seed (at provisioning) or a migration (afterwards) writes, so without this migration the
 * managers of every existing tenant would stay refused.
 *
 * **Who gets it: the `MANAGER` role, by name, in every tenant.** A role with no row for a grant gets one, switched on.
 * A row that exists already is left as its tenant left it, unless nobody decided it (see the note in `up()`), in
 * which case it is switched on. A row a person changed or deleted stays exactly as it is. Nothing is removed, no other
 * role gains anything, and running it again changes nothing. This is the method of
 * `GrantGoalsSkillsEventTypesEditPermissions1791000000821`, with one difference the age of these grants makes: see
 * the note in `up()` on the rows provisioning wrote.
 */
export class GrantManagerTaskSettingAndAvailabilityPermissions1791000000841 implements MigrationInterface {
	name = 'GrantManagerTaskSettingAndAvailabilityPermissions1791000000841';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		let truthy: string;

		switch (dbType) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.mysql:
				truthy = '1';
				break;
			case DatabaseTypeEnum.postgres:
				truthy = 'true';
				break;
			default:
				throw Error(`Unsupported database: ${dbType}`);
		}

		const run = (sql: string, parameters: unknown[] = []) =>
			queryRunner.query(replacePlaceholders(p(sql), dbType), parameters);
		const list = (values: readonly unknown[]) => values.map((_, index) => `$${index + 1}`).join(', ');

		// The roles that get the grants: each tenant's own, not deleted.
		const roles: Array<{ id: string; tenantId: string }> = await run(
			`SELECT "role"."id", "role"."tenantId"
			FROM "role"
			WHERE "role"."name" IN (${list(MANAGER_TASK_SETTING_AND_AVAILABILITY_ROLES)})
				AND "role"."tenantId" IS NOT NULL
				AND "role"."deletedAt" IS NULL`,
			[...MANAGER_TASK_SETTING_AND_AVAILABILITY_ROLES]
		);

		// Every row of the four grants that already exists. Read once, decided in code: MySQL refuses an UPDATE whose
		// subquery reads the table being updated, so the rows to switch on are named by id instead.
		const existing: Array<{
			id: string;
			roleId: string;
			permission: string;
			enabled: boolean | number;
			updatedByUserId: string | null;
			deletedAt: string | Date | null;
		}> = await run(
			`SELECT "id", "roleId", "permission", "enabled", "updatedByUserId", "deletedAt"
			FROM "role_permission" WHERE "permission" IN (${list(MANAGER_TASK_SETTING_AND_AVAILABILITY_GRANTS)})`,
			[...MANAGER_TASK_SETTING_AND_AVAILABILITY_GRANTS]
		);
		const byRole = new Map(existing.map((row) => [`${row.roleId}|${row.permission}`, row]));

		let inserted = 0;
		let enabled = 0;

		for (const { id: roleId, tenantId } of roles) {
			for (const permission of MANAGER_TASK_SETTING_AND_AVAILABILITY_GRANTS) {
				const row = byRole.get(`${roleId}|${permission}`);

				if (!row) {
					if (dbType === DatabaseTypeEnum.postgres) {
						await run(
							`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, true)`,
							[tenantId, roleId, permission]
						);
					} else {
						await run(
							`INSERT INTO "role_permission" ("id", "tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, $4, 1)`,
							[uuidV4(), tenantId, roleId, permission]
						);
					}
					inserted++;
					continue;
				}

				// A row that exists already is left as it is, unless nobody decided it. Unlike the grants of
				// `...821`, these four are old, and almost every tenant holds a SWITCHED-OFF row of each for `MANAGER`
				// that nobody chose:
				// - provisioning (`RolePermissionService.updateRolesAndPermissions`, when a tenant is created) writes a
				//   row of EVERY permission for every role, switched on only for the role's defaults. It runs inside
				//   the onboarding request, so the entity subscriber stamps the onboarding user as `createdByUserId`;
				// - the permission-reload migrations (`RolePermissionUtils.migrateRolePermissions`) write the same rows
				//   for a role that lacks them, with no user at all.
				// Either way the row was inserted and never changed, so it carries no `updatedByUserId`. A person who
				// switches a grant in Roles & Permissions UPDATES the role's row (the page creates one only where none
				// exists, and provisioning left none missing), which stamps their id as `updatedByUserId`; a deleted
				// row was deleted by someone. Those are a tenant's decision and stay exactly as they are. So a
				// switched-off row is switched on unless someone changed or deleted it: `createdByUserId` alone does
				// not make it a decision here.
				const isOff = row.enabled === false || Number(row.enabled) === 0;
				const undecided = !row.updatedByUserId && !row.deletedAt;
				if (isOff && undecided) {
					await run(`UPDATE "role_permission" SET "enabled" = ${truthy} WHERE "id" = $1`, [row.id]);
					enabled++;
				}
			}
		}

		console.log(
			chalk.green(
				`${this.name}: ${MANAGER_TASK_SETTING_AND_AVAILABILITY_GRANTS.join(', ')} — ${inserted} row(s) inserted and ${enabled} switched on, for ${roles.length} role(s).`
			)
		);
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: a grant may have been switched off,
	 * switched back on or given to another role by a tenant administrator since this ran. Rolling the grants back
	 * would take writes away from managers who may since depend on them, and a row this migration switched on cannot
	 * be told from one a reload would have written that way.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
