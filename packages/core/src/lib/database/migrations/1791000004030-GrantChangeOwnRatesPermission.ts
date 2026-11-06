import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The grant the admin roles get in every existing tenant (product owner decision, 2026-11-05). */
export const CHANGE_OWN_RATES_GRANTS: readonly PermissionsEnum[] = [PermissionsEnum.CHANGE_OWN_RATES];

export const CHANGE_OWN_RATES_ROLES: readonly RolesEnum[] = [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];

/**
 * Grants `CHANGE_OWN_RATES` to the `SUPER_ADMIN` and `ADMIN` roles of every tenant.
 *
 * Changing one's own rates (bill rate, its currency, minimum billing rate, pay period, weekly limit) now needs this
 * grant: an employee without it sees their rates and sends a rate change request instead, and someone else's rates
 * keep needing `ORG_EMPLOYEES_EDIT`. `DEFAULT_ROLE_PERMISSIONS` gives it to the same two roles of a new tenant. A
 * `role_permission` row is per-tenant data that only a seed (at provisioning) or a migration (afterwards) writes, so
 * without this migration the admins of every existing tenant could no longer change their own rates.
 *
 * **Who gets it: the `SUPER_ADMIN` and `ADMIN` roles, by name, in every tenant.** A role with no row gets one,
 * switched on. A row that exists already is left as its tenant left it, unless nobody decided it (a permission reload
 * in the same upgrade writes it switched off for every other role), in which case it is switched on. A row a person
 * changed or deleted stays exactly as it is. Nothing is removed, no other role gains anything, and running it again
 * changes nothing. This is the method of `GrantManagerTaskSettingAndAvailabilityPermissions1791000000841`.
 */
export class GrantChangeOwnRatesPermission1791000004030 implements MigrationInterface {
	name = 'GrantChangeOwnRatesPermission1791000004030';

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
			WHERE "role"."name" IN (${list(CHANGE_OWN_RATES_ROLES)})
				AND "role"."tenantId" IS NOT NULL
				AND "role"."deletedAt" IS NULL`,
			[...CHANGE_OWN_RATES_ROLES]
		);

		// Every row of the grant that already exists. Read once, decided in code: MySQL refuses an UPDATE whose
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
			FROM "role_permission" WHERE "permission" IN (${list(CHANGE_OWN_RATES_GRANTS)})`,
			[...CHANGE_OWN_RATES_GRANTS]
		);
		const byRole = new Map(existing.map((row) => [`${row.roleId}|${row.permission}`, row]));

		let inserted = 0;
		let enabled = 0;

		for (const { id: roleId, tenantId } of roles) {
			for (const permission of CHANGE_OWN_RATES_GRANTS) {
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

				// A row that exists already is left as it is, unless nobody decided it: a permission reload
				// (`RolePermissionUtils.migrateRolePermissions`) run earlier in the same upgrade writes the new grant for
				// every role, switched on only for its defaults, and carries no `updatedByUserId`. A person who switches
				// a grant in Roles & Permissions stamps their id as `updatedByUserId`; a deleted row was deleted by
				// someone. Those are a tenant's decision and stay exactly as they are.
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
				`${this.name}: ${CHANGE_OWN_RATES_GRANTS.join(', ')} — ${inserted} row(s) inserted and ${enabled} switched on, for ${roles.length} role(s).`
			)
		);
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: the grant may have been switched off,
	 * switched back on or given to another role by a tenant administrator since this ran, and the rows are inert
	 * without the code that reads them.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
