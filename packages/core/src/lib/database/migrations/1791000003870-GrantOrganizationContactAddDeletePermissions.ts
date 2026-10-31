import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/** The grants this migration gives, and the grant whose holders receive them. */
const HELD = PermissionsEnum.ORG_CONTACT_EDIT;
const GRANTED = [PermissionsEnum.ORG_CONTACT_ADD, PermissionsEnum.ORG_CONTACT_DELETE] as const;

/**
 * The bind parameters one statement may carry, well inside the strictest driver's ceiling (SQLite builds default to
 * 999), as the permission reload keeps them (`RolePermissionUtils.insertMissingRolePermissions`).
 */
const MAX_PARAMETERS = 900;

/** `items` in consecutive slices of at most `size`. */
function chunks<T>(items: T[], size: number): T[][] {
	const slices: T[][] = [];
	for (let offset = 0; offset < items.length; offset += size) {
		slices.push(items.slice(offset, offset + size));
	}
	return slices;
}

/**
 * Grants `ORG_CONTACT_ADD` and `ORG_CONTACT_DELETE` to every role that holds `ORG_CONTACT_EDIT` today, tenant by
 * tenant (ever-co/ever-gauzy#5468).
 *
 * Creating, editing and deleting a contact all ran under `ORG_CONTACT_EDIT`. The two new grants let a tenant give
 * a role the create or the delete without the edit; the routes accept them as alternatives to `ORG_CONTACT_EDIT`,
 * so a holder of the edit grant keeps every right it has. The rows are written here anyway so that the roles
 * screen shows the new grants switched on wherever the edit grant is, and so that switching the edit grant off
 * later leaves create and delete as the tenant had them, rather than taking them away unannounced.
 *
 * **Who gets them: exactly the live holders of the edit grant**, by the predicate
 * `RolePermissionService.checkRolePermission` applies (enabled, active, not archived, not soft-deleted). A holder
 * with no row for a new grant gets one, switched on; a holder whose row a permission reload wrote switched off
 * earlier in the same upgrade has it switched on (see the note in `up()`); a row a person created, changed or
 * deleted is left exactly as its tenant left it. Nothing is removed, and running it again changes nothing.
 *
 * New tenants get the grants from `DEFAULT_ROLE_PERMISSIONS` (SUPER_ADMIN and ADMIN, the edit grant's holders).
 *
 * It runs before the API starts, so it reads once per grant and writes in batches: the statements it issues grow
 * with the number of affected roles divided by the batch size, never with one round trip per role.
 */
export class GrantOrganizationContactAddDeletePermissions1791000003870 implements MigrationInterface {
	name = 'GrantOrganizationContactAddDeletePermissions1791000003870';

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

		// The live holders of the edit grant, by tenant and role.
		const holders: Array<{ tenantId: string; roleId: string }> = await run(
			`SELECT DISTINCT "held"."tenantId", "held"."roleId"
			FROM "role_permission" "held"
			WHERE "held"."permission" = $1
				AND "held"."enabled" = ${truthy}
				AND "held"."isActive" = ${truthy}
				AND "held"."isArchived" = ${falsy}
				AND "held"."deletedAt" IS NULL
				AND "held"."tenantId" IS NOT NULL`,
			[HELD]
		);

		const missing: Array<{ tenantId: string; roleId: string; permission: PermissionsEnum }> = [];
		const switchOn: string[] = [];

		for (const permission of GRANTED) {
			// Every row of the new grant that already exists. Read once, decided in code: MySQL refuses an UPDATE whose
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
				[permission]
			);
			const byHolder = new Map(existing.map((row) => [`${row.tenantId}|${row.roleId}`, row]));

			let inserted = 0;
			let enabled = 0;

			for (const { tenantId, roleId } of holders) {
				const row = byHolder.get(`${tenantId}|${roleId}`);

				if (!row) {
					missing.push({ tenantId, roleId, permission });
					inserted++;
					continue;
				}

				// A row that exists already is left as it is, unless nobody decided it. The permission-reload
				// migrations (`RolePermissionUtils.migrateRolePermissions`) insert every permission value a role lacks,
				// switched on only for the role's defaults, and run with the code being deployed: on an upgrade where
				// one of them runs before this migration, every tenant-granted editor of contacts gets SWITCHED-OFF rows
				// for the new grants first. Such a row was written by a migration, so it carries no user (no
				// `createdByUserId`, no `updatedByUserId`) and is live. A row a person created or changed carries their
				// id, and a deleted row was deleted by someone; both are a tenant's decision and stay as they are.
				const isOff = row.enabled === false || Number(row.enabled) === 0;
				const unattributed = !row.createdByUserId && !row.updatedByUserId && !row.deletedAt;
				if (isOff && unattributed) {
					switchOn.push(row.id);
					enabled++;
				}
			}

			console.log(
				chalk.green(
					`${this.name}: ${permission} to insert for ${inserted} role(s) and to switch on for ${enabled} role(s) a reload had written it switched off for.`
				)
			);
		}

		// MySQL and the SQLite drivers have no UUID column default, so those rows carry an id made here.
		const explicitId = dbType !== DatabaseTypeEnum.postgres;
		const columns = explicitId
			? `"id", "tenantId", "roleId", "permission", "enabled"`
			: `"tenantId", "roleId", "permission", "enabled"`;
		const perRow = explicitId ? 4 : 3;
		for (const batch of chunks(missing, Math.floor(MAX_PARAMETERS / perRow))) {
			const values: unknown[] = [];
			const groups = batch.map(({ tenantId, roleId, permission }) => {
				const row = explicitId ? [uuidV4(), tenantId, roleId, permission] : [tenantId, roleId, permission];
				const placeholders = row.map((_, index) => `$${values.length + index + 1}`);
				values.push(...row);
				return `(${placeholders.join(', ')}, ${truthy})`;
			});
			await run(`INSERT INTO "role_permission" (${columns}) VALUES ${groups.join(', ')}`, values);
		}

		for (const batch of chunks(switchOn, MAX_PARAMETERS)) {
			const placeholders = batch.map((_, index) => `$${index + 1}`);
			await run(
				`UPDATE "role_permission" SET "enabled" = ${truthy} WHERE "id" IN (${placeholders.join(', ')})`,
				batch
			);
		}

		console.log(
			chalk.green(`${this.name}: ${missing.length} row(s) inserted, ${switchOn.length} row(s) switched on.`)
		);
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op, as for the platform's other permission migrations: the new rows may have been switched off,
	 * switched back on or granted to other roles by a tenant administrator since this ran, and they are inert without
	 * the code that reads them. Rolling the code back is what takes the grants out of use.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name}: nothing to revert (see the note on down()).`));
	}
}
