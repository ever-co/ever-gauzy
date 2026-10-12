import { IsNull } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { MultiORM, MultiORMEnum } from '../core/utils';

/**
 * Keys a client `where` may never use to choose the tenant of the rows it reads: the tenant is always
 * the caller's own, from the request context.
 */
const TENANT_KEYS = ['tenantId', 'tenant'];

/**
 * Pins a client-supplied email-template `where` to the caller's tenant plus the GLOBAL templates
 * (`tenantId IS NULL AND organizationId IS NULL`), which every tenant reads as defaults.
 *
 * `EmailTemplateService` is a plain `CrudService` — it does not add a tenant predicate on its own — so
 * a `where` that named no tenant (or a relation filter such as `where[organization][isActive]=true`)
 * used to list the templates of EVERY tenant (GHSA-44pv-34gx-q9p4).
 *
 * - `tenantId` / `tenant` from the client are dropped; the caller's tenant is used.
 * - An `organization` relation filter is dropped; only its `id` is kept, as `organizationId`.
 * - The other client filters (language, name, organization id...) narrow the tenant arm; the global arm
 *   keeps the non-scope filters but never an organization.
 *
 * @param where - The client `where`, possibly absent.
 * @param tenantId - The caller's tenant (`RequestContext.currentTenantId()`).
 * @param ormType - The active ORM, which decides how the two arms are OR-ed together.
 * @returns A where clause for `CrudService.paginate` / `findAll` of the active ORM.
 */
export function scopeEmailTemplateWhere(where: unknown, tenantId: ID | null | undefined, ormType: MultiORM): any {
	const filters: Record<string, any> =
		where && typeof where === 'object' && !Array.isArray(where) ? { ...where } : {};

	for (const key of TENANT_KEYS) {
		delete filters[key];
	}

	const { organization } = filters;
	delete filters['organization'];
	if (!filters['organizationId'] && organization && typeof organization === 'object' && organization.id) {
		filters['organizationId'] = organization.id;
	}

	const globalFilters = { ...filters };
	delete globalFilters['organizationId'];

	const isMikroOrm = ormType === MultiORMEnum.MikroORM;
	// MikroORM compiles a literal null to IS NULL; TypeORM needs the explicit operator.
	const nullValue = isMikroOrm ? null : IsNull();

	const globalArm = { ...globalFilters, tenantId: nullValue, organizationId: nullValue };
	// Without a tenant in the request context there is no caller tenant to read: globals only.
	const arms = tenantId ? [{ ...filters, tenantId }, globalArm] : [globalArm];

	return isMikroOrm ? { $or: arms } : arms;
}

/**
 * Strips the fields that decide WHICH tenant / organization a template belongs to (and its id) from a
 * client write payload, so an update can never re-home a template into another tenant or turn it into
 * a global one.
 *
 * @param input - The client payload.
 * @returns A shallow copy without `id`, `tenant`, `tenantId`, `organization` and `organizationId`.
 */
export function stripEmailTemplateScopeFields<T extends object>(input: T): Partial<T> {
	const payload: Record<string, any> = input && typeof input === 'object' ? { ...input } : {};
	for (const key of ['id', 'tenant', 'tenantId', 'organization', 'organizationId']) {
		delete payload[key];
	}
	return payload as Partial<T>;
}
