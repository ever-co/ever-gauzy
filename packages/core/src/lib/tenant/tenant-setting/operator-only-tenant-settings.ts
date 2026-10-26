import { ForbiddenException } from '@nestjs/common';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { ID, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { isListedInstallationOperator, OPERATOR_USER_IDS_ENV } from './global-setting-writer';

/**
 * Tenant settings that only the operator of the installation may create, change or remove through the generic
 * tenant-settings writes: `POST /tenant-setting`, `POST /tenant-setting/dynamic`, the row routes the CRUD controller
 * gives it (`POST /`, `PUT :id`, `DELETE :id`, `DELETE :id/soft`, `PUT :id/recover`), their GraphQL fields, an
 * import and a factory reset.
 *
 * Today that is one shape, `docs.<organizationId>.quotaBytes`: an organization's Documents storage limit in bytes,
 * `0` = unlimited. It is an ordinary row of the tenant's own settings, so `TENANT_SETTING`, which every tenant's
 * admins hold, was enough to raise one's own limit or lift it. Owner decision (2026-10-22): only the installation
 * operator, or the tenant's billing plan, sets it; `DOCS_MANAGE` sees the usage and the limit but does not change
 * it. The rows that exist stay as they are.
 *
 * Server code that sets the limit on a tenant's behalf (the billing plan, once it does) calls
 * `TenantSettingService.saveSettings` itself: these checks guard the entry points a request reaches.
 */
const OPERATOR_ONLY_TENANT_SETTINGS: readonly RegExp[] = [/^docs\.[\s\S]+\.quotabytes$/];

/** The `code` of the refusal {@link assertMayWriteTenantSettings} answers. */
export const TENANT_SETTING_OPERATOR_ONLY = 'TENANT_SETTING_OPERATOR_ONLY';

/**
 * Whether a tenant setting name is one only the operator of the installation may write.
 *
 * The name is compared trimmed and lower-cased: a collation that ignores case or trailing spaces (MySQL's) reads
 * `DOCS.<id>.QUOTABYTES ` as the row the Documents plugin reads, and an organization id may be written in capitals.
 *
 * @param name The setting name, as a caller sent it.
 */
export function isOperatorOnlyTenantSetting(name: unknown): boolean {
	if (typeof name !== 'string') {
		return false;
	}
	const normalized = name.trim().toLowerCase();
	return OPERATOR_ONLY_TENANT_SETTINGS.some((pattern) => pattern.test(normalized));
}

/**
 * Whether the signed-in user operates this installation: a super admin listed by user id in
 * `EVER_OPERATOR_USER_IDS`. With no list, nobody (see `isListedInstallationOperator`).
 *
 * @param env The environment to read, the process's by default.
 */
export function isInstallationOperator(env: Record<string, string | undefined> = process.env): boolean {
	return isListedInstallationOperator(
		RequestContext.currentUserId(),
		RequestContext.hasRole(RolesEnum.SUPER_ADMIN),
		env
	);
}

/**
 * Refuses a write that would create, change or remove an operator-only setting, unless the signed-in user operates
 * the installation. A write that names none of them passes, whoever makes it.
 *
 * @param names The names of the rows the write touches: the keys it saves, the rows it updates or removes, and the
 * name an update gives a row.
 * @throws ForbiddenException with `TENANT_SETTING_OPERATOR_ONLY`.
 */
export function assertMayWriteTenantSettings(names: Iterable<unknown>): void {
	for (const name of names) {
		if (!isOperatorOnlyTenantSetting(name)) {
			continue;
		}
		if (isInstallationOperator()) {
			return;
		}
		throw new ForbiddenException({
			message: `${TENANT_SETTING_OPERATOR_ONLY}: only the operator of this installation (${OPERATOR_USER_IDS_ENV}) may change an organization's Documents storage limit.`,
			code: TENANT_SETTING_OPERATOR_ONLY
		});
	}
}

/**
 * The criteria of a wipe of a tenant's settings (a clean import, a factory reset), narrowed to keep its operator-only
 * rows, soft-deleted ones included, unless the signed-in user operates the installation. Removing such a row puts the
 * deployment default back, which may be no limit at all.
 *
 * @param repository The `tenant_setting` repository (TypeORM, as the wipes use).
 * @param conditions The wipe's criteria, naming the tenant.
 * @returns The criteria to delete with.
 */
export async function keepingOperatorOnlySettings(
	repository: Pick<Repository<any>, 'find'>,
	conditions: { tenantId: ID } & FindOptionsWhere<any>
): Promise<FindOptionsWhere<any>> {
	if (isInstallationOperator()) {
		return conditions;
	}
	const rows: { id: ID; name?: unknown }[] = await repository.find({
		select: { id: true, name: true },
		where: { tenantId: conditions.tenantId },
		withDeleted: true
	});
	const kept = rows.filter((row) => isOperatorOnlyTenantSetting(row.name)).map((row) => row.id);
	return kept.length > 0 ? { ...conditions, id: Not(In(kept)) } : conditions;
}
