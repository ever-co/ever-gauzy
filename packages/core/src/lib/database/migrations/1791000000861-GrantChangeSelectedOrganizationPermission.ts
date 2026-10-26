import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The grant, and the roles that get it in every existing tenant. */
export const CHANGE_SELECTED_ORGANIZATION_GRANTS: readonly PermissionsEnum[] = [
	PermissionsEnum.CHANGE_SELECTED_ORGANIZATION
];
export const CHANGE_SELECTED_ORGANIZATION_ROLES: readonly RolesEnum[] = [RolesEnum.MANAGER, RolesEnum.VIEWER];

/**
 * Grants `CHANGE_SELECTED_ORGANIZATION` to the `MANAGER` and `VIEWER` roles of every tenant.
 *
 * Since ever-co/ever-gauzy#11316 (owner decision 1) a non-admin works only in the organization named in their access
 * token, and moves to another organization of the tenant with `POST /auth/switch-organization`, which requires
 * `CHANGE_SELECTED_ORGANIZATION`. `SUPER_ADMIN`, `ADMIN`, `DATA_ENTRY` and `EMPLOYEE` hold it by default; `MANAGER` and
 * `VIEWER` did not, so a manager or viewer who belongs to two organizations was stuck in one. The route still checks
 * the membership (`AuthService.switchOrganization`), so the grant only lets a user move among their own
 * organizations. `DEFAULT_ROLE_PERMISSIONS` lists the same grant for a new tenant. A `role_permission` row is
 * per-tenant data that only a seed (at provisioning) or a migration (afterwards) writes, so without this migration the
 * managers and viewers of every existing tenant would stay stuck.
 *
 * **Who gets it: the two roles, by name, in every tenant.** A role with no row for the grant gets one, switched on. A
 * row that exists already is left as its tenant left it, unless nobody decided it (see the note in `up()`), in which
 * case it is switched on. A row a person changed or deleted stays exactly as it is. Nothing is removed, no other role
 * gains anything, and running it again changes nothing. This is the method of
 * `GrantGoalsSkillsEventTypesEditPermissions1791000000821`, with the refinement of
 * `GrantManagerTaskSettingAndAvailabilityPermissions1791000000841` for a grant that is as old as the tenants.
 */
export class GrantChangeSelectedOrganizationPermission1791000000861 implements MigrationInterface {
	name = 'GrantChangeSelectedOrganizationPermission1791000000861';

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

		// The roles that get the grant: each tenant's own, not deleted.
		const roles: Array<{ id: string; tenantId: string }> = await run(
			`SELECT "role"."id", "role"."tenantId"
			FROM "role"
			WHERE "role"."name" IN (${list(CHANGE_SELECTED_ORGANIZATION_ROLES)})
				AND "role"."tenantId" IS NOT NULL
				AND "role"."deletedAt" IS NULL`,
			[...CHANGE_SELECTED_ORGANIZATION_ROLES]
		);

		// Every row of the grant that already exists. Read once, decided in code: MySQL refuses an UPDATE whose subquery
		// reads the table being updated, so the rows to switch on are named by id instead.
		const existing: Array<{
			id: string;
			roleId: string;
			permission: string;
			enabled: boolean | number;
			updatedByUserId: string | null;
			deletedAt: string | Date | null;
		}> = await run(
			`SELECT "id", "roleId", "permission", "enabled", "updatedByUserId", "deletedAt"
			FROM "role_permission" WHERE "permission" IN (${list(CHANGE_SELECTED_ORGANIZATION_GRANTS)})`,
			[...CHANGE_SELECTED_ORGANIZATION_GRANTS]
		);
		const byRole = new Map(existing.map((row) => [`${row.roleId}|${row.permission}`, row]));

		let inserted = 0;
		let enabled = 0;

		for (const { id: roleId, tenantId } of roles) {
			for (const permission of CHANGE_SELECTED_ORGANIZATION_GRANTS) {
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

				// A row that exists already is left as it is, unless nobody decided it. The grant is old, so almost every
				// tenant holds a SWITCHED-OFF row of it for `MANAGER` and `VIEWER` that nobody chose:
				// - provisioning (`RolePermissionService.updateRolesAndPermissions`, when a tenant is created) writes a
				//   row of EVERY permission for every role, switched on only for the role's defaults. It runs inside
				//   the onboarding request, so the entity subscriber stamps the onboarding user as `createdByUserId`;
				// - the permission-reload migrations (`RolePermissionUtils.migrateRolePermissions`) write the same rows
				//   for a role that lacks them, with no user at all.
				// Either way the row was inserted and never changed, so it carries no `updatedByUserId`. A person who
				// switches a grant in Roles & Permissions UPDATES the role's row, which stamps their id as
				// `updatedByUserId`; a deleted row was deleted by someone. Those are a tenant's decision and stay exactly
				// as they are. So a switched-off row is switched on unless someone changed or deleted it:
				// `createdByUserId` alone does not make it a decision here.
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
				`${this.name}: ${CHANGE_SELECTED_ORGANIZATION_GRANTS.join(', ')} — ${inserted} row(s) inserted and ${enabled} switched on, for ${roles.length} role(s).`
			)
		);
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: the grant may have been switched off,
	 * switched back on or given to another role by a tenant administrator since this ran. Taking it back would strand
	 * managers and viewers of several organizations in one of them again, and a row this migration switched on cannot be
	 * told from one a person or a reload would have written that way.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
