import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The new write grants, and the roles that get them in every existing tenant (owner decision 2, 2026-10-22). */
export const GOALS_SKILLS_EVENT_TYPES_EDIT_GRANTS: readonly PermissionsEnum[] = [
	PermissionsEnum.GOALS_EDIT,
	PermissionsEnum.SKILLS_EDIT,
	PermissionsEnum.EVENT_TYPES_EDIT
];
export const GOALS_SKILLS_EVENT_TYPES_EDIT_ROLES: readonly RolesEnum[] = [
	RolesEnum.SUPER_ADMIN,
	RolesEnum.ADMIN,
	RolesEnum.MANAGER
];

/**
 * Grants `GOALS_EDIT`, `SKILLS_EDIT` and `EVENT_TYPES_EDIT` to the `SUPER_ADMIN`, `ADMIN` and `MANAGER` roles of
 * every tenant.
 *
 * The goal, KPI and key-result routes, the skill routes and the event-type routes wrote with no permission at all
 * (GHSA-v79w-54p2-wmh5): `PermissionGuard` answers `true` to a route that states none, so any signed-in member of
 * the tenant could create, change or delete those rows. Owner decision 2 (2026-10-22) gates them with these three
 * new grants, held by the tenant's administrators and managers. A `role_permission` row is per-tenant data that only
 * a seed (at provisioning, from `DEFAULT_ROLE_PERMISSIONS`, which lists the same grants) or a migration (afterwards)
 * writes, so without this migration the administrators and managers of every existing tenant would be refused the
 * moment the gated routes ship.
 *
 * **Who gets it: the three roles, by name, in every tenant.** A role with no row for a grant gets one, switched on.
 * A row that exists already is left as its tenant left it — unless nobody decided it (see the note in `up()`), in
 * which case it is switched on. A row a person created, changed or deleted stays exactly as it is. Nothing is
 * removed, no other role gains anything, and running it again changes nothing.
 */
export class GrantGoalsSkillsEventTypesEditPermissions1791000000821 implements MigrationInterface {
	name = 'GrantGoalsSkillsEventTypesEditPermissions1791000000821';

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
			WHERE "role"."name" IN (${list(GOALS_SKILLS_EVENT_TYPES_EDIT_ROLES)})
				AND "role"."tenantId" IS NOT NULL
				AND "role"."deletedAt" IS NULL`,
			[...GOALS_SKILLS_EVENT_TYPES_EDIT_ROLES]
		);

		// Every row of the three grants that already exists. Read once, decided in code: MySQL refuses an UPDATE whose
		// subquery reads the table being updated, so the rows to switch on are named by id instead.
		const existing: Array<{
			id: string;
			roleId: string;
			permission: string;
			enabled: boolean | number;
			createdByUserId: string | null;
			updatedByUserId: string | null;
			deletedAt: string | Date | null;
		}> = await run(
			`SELECT "id", "roleId", "permission", "enabled", "createdByUserId", "updatedByUserId", "deletedAt"
			FROM "role_permission" WHERE "permission" IN (${list(GOALS_SKILLS_EVENT_TYPES_EDIT_GRANTS)})`,
			[...GOALS_SKILLS_EVENT_TYPES_EDIT_GRANTS]
		);
		const byRole = new Map(existing.map((row) => [`${row.roleId}|${row.permission}`, row]));

		let inserted = 0;
		let enabled = 0;

		for (const { id: roleId, tenantId } of roles) {
			for (const permission of GOALS_SKILLS_EVENT_TYPES_EDIT_GRANTS) {
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

				// A row that exists already is left as it is — unless nobody decided it. The permission-reload
				// migrations (`RolePermissionUtils.migrateRolePermissions`) insert every permission value a role lacks,
				// switched on only for the role's defaults, and they run with the code being deployed, so on an upgrade
				// where one of them runs before this migration a role may already hold a SWITCHED-OFF row for one of
				// these grants. Such a row was written by a migration, so it carries no user — no `createdByUserId`, no
				// `updatedByUserId` (the entity subscriber stamps both from the request) — and is live. A row a person
				// created or changed carries their id, and a deleted row was deleted by someone; both are a tenant's
				// decision and stay exactly as they are.
				const isOff = row.enabled === false || Number(row.enabled) === 0;
				const unattributed = !row.createdByUserId && !row.updatedByUserId && !row.deletedAt;
				if (isOff && unattributed) {
					await run(`UPDATE "role_permission" SET "enabled" = ${truthy} WHERE "id" = $1`, [row.id]);
					enabled++;
				}
			}
		}

		console.log(
			chalk.green(
				`${this.name}: ${GOALS_SKILLS_EVENT_TYPES_EDIT_GRANTS.join(', ')} — ${inserted} row(s) inserted and ${enabled} switched on, for ${roles.length} role(s).`
			)
		);
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: a grant may have been switched off,
	 * switched back on or given to another role by a tenant administrator since this ran, and the rows are inert
	 * without the code that reads them. Rolling the code back is what takes the grants out of use.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
