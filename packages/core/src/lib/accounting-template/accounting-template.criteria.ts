import { FindOptionsWhere, IsNull } from 'typeorm';
import { FilterQuery as MikroFilterQuery } from '@mikro-orm/core';
import { AccountingTemplateTypeEnum, IAccountingTemplate, ID, LanguagesEnum } from '@gauzy/contracts';

/**
 * The (languageCode, templateType) pair a template lookup is keyed on.
 */
export interface IAccountingTemplateLookup {
	languageCode: LanguagesEnum | string;
	templateType: AccountingTemplateTypeEnum | string;
}

/**
 * The tenant/organization scope a template lookup runs in.
 */
export interface IAccountingTemplateScope extends IAccountingTemplateLookup {
	tenantId: ID;
	organizationId?: ID;
}

/**
 * TypeORM criteria for the GLOBAL accounting template — the seeded row that belongs to no tenant
 * and no organization (`"tenantId" IS NULL AND "organizationId" IS NULL`).
 *
 * The NULL scope MUST be spelled with the explicit `IsNull()` operator. A literal `null` used to be
 * silently dropped from the SQL by TypeORM (0.3 always, 1.0 under `invalidWhereValuesBehavior.null:
 * 'ignore'`), which turned this "global only" lookup into "any tenant's template with the same
 * language and type" — GHSA-44pv-34gx-q9p4. `IsNull()` emits `IS NULL` under every setting.
 */
export function globalAccountingTemplateWhere({
	languageCode,
	templateType
}: IAccountingTemplateLookup): FindOptionsWhere<IAccountingTemplate> {
	return {
		languageCode,
		templateType,
		tenantId: IsNull(),
		organizationId: IsNull()
	} as FindOptionsWhere<IAccountingTemplate>;
}

/**
 * MikroORM equivalent of {@link globalAccountingTemplateWhere}. MikroORM maps a `null` filter value
 * to `IS NULL` natively, so `null` is the correct spelling on this side.
 */
export function globalAccountingTemplateMikroWhere({
	languageCode,
	templateType
}: IAccountingTemplateLookup): MikroFilterQuery<IAccountingTemplate> {
	return {
		languageCode,
		templateType,
		tenantId: null,
		organizationId: null
	} as MikroFilterQuery<IAccountingTemplate>;
}

/**
 * Criteria for a TENANT-scoped template lookup. `organizationId` is optional: when the caller does
 * not pass one the key is left `undefined` and (under `invalidWhereValuesBehavior.undefined:
 * 'ignore'`) omitted, matching any organization inside the tenant — the long-standing behavior.
 * A `null` organizationId is deliberately normalised to `undefined` here so a client sending
 * `organizationId: null` keeps meaning "any organization" rather than `IS NULL`; any other value —
 * including an empty string — stays a predicate.
 */
export function tenantAccountingTemplateWhere({
	languageCode,
	templateType,
	tenantId,
	organizationId
}: IAccountingTemplateScope): FindOptionsWhere<IAccountingTemplate> {
	return {
		languageCode,
		templateType,
		tenantId,
		...(organizationId !== null && organizationId !== undefined ? { organizationId } : {})
	} as FindOptionsWhere<IAccountingTemplate>;
}
