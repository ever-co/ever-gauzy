/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a read of two columns needs and none of which is
 * available outside a running application. The seam is doubled at the module boundary, exactly as the
 * package's other service specs do, and **the service under test is the real one**: only the entity
 * classes, the request context and the two repositories are substituted.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Product: class {},
		ProductTranslation: class {},
		ProductVariant: class {},
		ProductVariantSetting: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => 'tenant-1',
			currentOrganizationId: () => 'organization-1',
			currentEmployeeId: () => null,
			currentRequest: () => ({ headers: {} }),
			hasPermission: () => false
		}
	};
});

import { RequestContext } from '@gauzy/core';
import { ProductVariantSaleService } from './product-variant-sale.service';

/**
 * How a variant is sold, as a caller that does not own the catalogue reads it.
 *
 * Two columns answer the two questions and the suite is about the *answers*, not the queries:
 *
 * - a variant is offered on recurring terms exactly when its settings mark it so, and a variant whose
 *   settings were never written has not been marked — which is a different thing from being marked
 *   off, and has the same answer;
 * - the variant a product is offered as is the one the operator marked, and a product whose variants
 *   none of them carry the mark answers with nothing rather than with whichever row a query returned
 *   first. That control case is in the suite deliberately: the tempting implementation answers with a
 *   sibling, and a plan attached to a product would then bill a variant nobody chose.
 *
 * Tenancy is asserted as well: a variant of another organization is not found, so a caller cannot
 * attach a plan to it and cannot learn that it exists.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_ORG = 'organization-2';
const PRODUCT = 'product-1';
const DEFAULT_VARIANT = 'variant-default';
const SIBLING_VARIANT = 'variant-sibling';
const SUBSCRIBABLE_VARIANT = 'variant-subscribable';
const PLAIN_VARIANT = 'variant-plain';
const UNMARKED_VARIANT = 'variant-unmarked';

/** One `product_variant` row, as the read sees it. */
interface IVariantRow {
	id: string;
	productId: string;
	tenantId?: string;
	organizationId?: string;
	isDefault?: boolean;
}

/** One `product_variant_setting` row. */
interface ISettingRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	productVariant: { id: string };
	isSubscription: boolean;
}

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row.
 */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		// A relation filter — `{ productVariant: { id } }` — is narrowed on the related row.
		if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
			return Object.entries(expected).every(
				([key, value]) => String(row[field]?.[key] ?? '') === String(value ?? '')
			);
		}

		return String(row[field] ?? '') === String(expected ?? '');
	});
}

/**
 * @param rows The rows of one table.
 * @returns A repository double that narrows by the stated `where`, and the options it was asked with.
 */
function repository(rows: object[]) {
	const options: Array<Record<string, unknown>> = [];

	return {
		options,
		findOne: async (stated: Record<string, unknown> = {}) => {
			options.push(stated);

			return rows.filter((row) => matches(row as Record<string, any>, stated.where as Record<string, any>))[0] ?? null;
		}
	};
}

/**
 * @param variants The `product_variant` rows.
 * @param settings The `product_variant_setting` rows.
 * @returns The service, wired to the two doubles, and the doubles themselves.
 */
function fixture(variants: IVariantRow[] = [], settings: ISettingRow[] = []) {
	const productVariants = repository(variants);
	const variantSettings = repository(settings);

	return {
		productVariants,
		variantSettings,
		service: new ProductVariantSaleService(productVariants as never, variantSettings as never)
	};
}

/** A variant of the fixture product. */
const variant = (overrides: Partial<IVariantRow> & { id: string }): IVariantRow => ({
	productId: PRODUCT,
	tenantId: TENANT,
	organizationId: ORG,
	...overrides
});

/** A settings row for a variant. */
const settings = (variantId: string, isSubscription: boolean, extra: Partial<ISettingRow> = {}): ISettingRow => ({
	id: `settings-${variantId}`,
	tenantId: TENANT,
	organizationId: ORG,
	productVariant: { id: variantId },
	isSubscription,
	...extra
});

describe('ProductVariantSaleService — how a variant is sold', () => {
	afterEach(() => jest.restoreAllMocks());

	it('reports a variant whose settings mark it as sellable on a recurring basis', async () => {
		const { service } = fixture([variant({ id: SUBSCRIBABLE_VARIANT })], [settings(SUBSCRIBABLE_VARIANT, true)]);

		expect(await service.isVariantSubscribable(SUBSCRIBABLE_VARIANT)).toBe(true);
	});

	it('reports a variant whose settings mark it off as not sellable on a recurring basis', async () => {
		const { service } = fixture([variant({ id: PLAIN_VARIANT })], [settings(PLAIN_VARIANT, false)]);

		expect(await service.isVariantSubscribable(PLAIN_VARIANT)).toBe(false);
	});

	it('reports a variant whose settings were never written as not marked', async () => {
		// The absent case: no settings row at all. The mark is what makes a variant subscribable, so a
		// variant that has never been marked is not — and this is not the same question as whether the
		// variant exists.
		const { service } = fixture([variant({ id: UNMARKED_VARIANT })]);

		expect(await service.isVariantSubscribable(UNMARKED_VARIANT)).toBe(false);
	});

	it('does not read a settings row of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, variantSettings } = fixture(
			[variant({ id: SUBSCRIBABLE_VARIANT })],
			[settings(SUBSCRIBABLE_VARIANT, true)]
		);

		expect(await service.isVariantSubscribable(SUBSCRIBABLE_VARIANT)).toBe(false);
		expect(variantSettings.options[0]).toMatchObject({
			where: { tenantId: TENANT, organizationId: OTHER_ORG }
		});
	});

	it('reports the variant the operator marked as the product default', async () => {
		const { service } = fixture([
			variant({ id: DEFAULT_VARIANT, isDefault: true }),
			variant({ id: SIBLING_VARIANT })
		]);

		expect(await service.defaultVariantOf(PRODUCT)).toBe(DEFAULT_VARIANT);
	});

	it('answers with nothing when no variant of the product carries the mark', async () => {
		// The control: the tempting answer is a sibling, and a plan attached to the product would then
		// bill a variant the operator never chose. Nothing is the honest answer.
		const { service } = fixture([variant({ id: SIBLING_VARIANT }), variant({ id: SUBSCRIBABLE_VARIANT })]);

		expect(await service.defaultVariantOf(PRODUCT)).toBeNull();
	});

	it('does not read the default variant of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, productVariants } = fixture([variant({ id: DEFAULT_VARIANT, isDefault: true })]);

		expect(await service.defaultVariantOf(PRODUCT)).toBeNull();
		expect(productVariants.options[0]).toMatchObject({
			where: { productId: PRODUCT, isDefault: true, tenantId: TENANT, organizationId: OTHER_ORG }
		});
	});

	it('reads the default variant of the named product only', async () => {
		const { service } = fixture([
			variant({ id: DEFAULT_VARIANT, isDefault: true }),
			variant({ id: 'variant-of-another-product', productId: 'product-2', isDefault: true })
		]);

		expect(await service.defaultVariantOf(PRODUCT)).toBe(DEFAULT_VARIANT);
	});

	it('refuses to answer when no identifier was named', async () => {
		const { service, productVariants, variantSettings } = fixture();

		await expect(service.isVariantSubscribable(undefined as never)).rejects.toThrow(/CATALOG_VARIANT_REQUIRED/);
		await expect(service.defaultVariantOf(undefined as never)).rejects.toThrow(/CATALOG_PRODUCT_REQUIRED/);
		expect(variantSettings.options).toEqual([]);
		expect(productVariants.options).toEqual([]);
	});
});
