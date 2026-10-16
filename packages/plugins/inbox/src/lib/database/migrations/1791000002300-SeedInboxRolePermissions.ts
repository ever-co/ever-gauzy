import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { dialectOf, InboxDialect, lockMigrations, q } from '../migration-helpers';

/** Who gets which inbox grant (plan 04 §2): administrators all three, managers and employees `INBOX_VIEW`. */
export const INBOX_ROLE_GRANTS: Readonly<Record<string, readonly PermissionsEnum[]>> = {
	[RolesEnum.SUPER_ADMIN]: [
		PermissionsEnum.INBOX_VIEW,
		PermissionsEnum.INBOX_MAILBOX_MANAGE,
		PermissionsEnum.INBOX_MAILBOX_READ_ALL
	],
	[RolesEnum.ADMIN]: [
		PermissionsEnum.INBOX_VIEW,
		PermissionsEnum.INBOX_MAILBOX_MANAGE,
		PermissionsEnum.INBOX_MAILBOX_READ_ALL
	],
	[RolesEnum.MANAGER]: [PermissionsEnum.INBOX_VIEW],
	[RolesEnum.EMPLOYEE]: [PermissionsEnum.INBOX_VIEW]
};

/** The n-th (1-based) bind parameter of the dialect. */
function param(d: InboxDialect, n: number): string {
	return d === 'postgres' ? `$${n}` : '?';
}

/**
 * Grants the inbox permissions to the existing roles of every tenant (G-P3-1): `SUPER_ADMIN` and `ADMIN` get
 * `INBOX_VIEW`, `INBOX_MAILBOX_MANAGE` and `INBOX_MAILBOX_READ_ALL`; `MANAGER` and `EMPLOYEE` get `INBOX_VIEW`.
 * A `role_permission` row is per-tenant data that only a seed (at provisioning, from `DEFAULT_ROLE_PERMISSIONS`,
 * which lists the same grants) or a migration writes, so without this the routes would refuse every existing
 * user the moment the Inbox is switched on.
 *
 * A plugin migration: it runs only where `GAUZY_INBOX_ENABLED=true` loads the plugin. A role that has no row
 * for a grant gets one, switched on. A row that exists is left as its tenant left it — unless nobody decided it
 * (no `createdByUserId` / `updatedByUserId`, not deleted, switched off: what a permission-reload migration
 * writes for a value a role lacks), which is switched on. Running it again changes nothing.
 */
export class SeedInboxRolePermissions1791000002300 implements MigrationInterface {
	name = 'SeedInboxRolePermissions1791000002300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		const truthy = d === 'postgres' ? 'true' : '1';
		const c = (name: string) => q(d, name);
		const names = Object.keys(INBOX_ROLE_GRANTS);
		const permissions = [...new Set(Object.values(INBOX_ROLE_GRANTS).flat())];

		const roles: Array<{ id: string; tenantId: string; name: string }> = await queryRunner.query(
			`SELECT ${c('id')}, ${c('tenantId')}, ${c('name')} FROM ${c('role')}
			WHERE ${c('tenantId')} IS NOT NULL AND ${c('deletedAt')} IS NULL
				AND ${c('name')} IN (${names.map((_, index) => param(d, index + 1)).join(', ')})`,
			names
		);
		if (roles.length === 0) {
			return;
		}

		const existing: Array<{
			id: string;
			roleId: string;
			permission: string;
			enabled: boolean | number;
			createdByUserId: string | null;
			updatedByUserId: string | null;
			deletedAt: string | Date | null;
		}> = await queryRunner.query(
			`SELECT ${c('id')}, ${c('roleId')}, ${c('permission')}, ${c('enabled')}, ${c('createdByUserId')}, ${c('updatedByUserId')}, ${c('deletedAt')}
			FROM ${c('role_permission')}
			WHERE ${c('permission')} IN (${permissions.map((_, index) => param(d, index + 1)).join(', ')})`,
			permissions
		);
		const byRole = new Map(existing.map((row) => [`${row.roleId}|${row.permission}`, row]));

		for (const role of roles) {
			for (const permission of INBOX_ROLE_GRANTS[role.name] ?? []) {
				const row = byRole.get(`${role.id}|${permission}`);
				if (!row) {
					if (d === 'postgres') {
						await queryRunner.query(
							`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES ($1, $2, $3, true)`,
							[role.tenantId, role.id, permission]
						);
					} else {
						await queryRunner.query(
							`INSERT INTO ${c('role_permission')} (${c('id')}, ${c('tenantId')}, ${c('roleId')}, ${c('permission')}, ${c('enabled')}) VALUES (?, ?, ?, ?, 1)`,
							[randomUUID(), role.tenantId, role.id, permission]
						);
					}
					continue;
				}
				const isOff = row.enabled === false || Number(row.enabled) === 0;
				const unattributed = !row.createdByUserId && !row.updatedByUserId && !row.deletedAt;
				if (isOff && unattributed) {
					await queryRunner.query(
						`UPDATE ${c('role_permission')} SET ${c('enabled')} = ${truthy} WHERE ${c('id')} = ${param(d, 1)}`,
						[row.id]
					);
				}
			}
		}
	}

	/**
	 * Deliberate no-op, as for the platform's other permission migrations: a grant may have been switched off,
	 * back on or given to another role by a tenant administrator since this ran, and the rows are inert without
	 * the plugin that reads them.
	 */
	public async down(): Promise<void> {
		return;
	}
}
