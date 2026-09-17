/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a read of a product needs and none of which is
 * available outside a running application. The seam is doubled at the module boundary, exactly as the
 * package's other service specs do, and **the service under test is the real one**.
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
			// The platform's own default: a request that states no language asks in English.
			currentRequest: () => ({ headers: {} }),
			hasPermission: () => false
		}
	};
});

import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { CatalogItemService } from './catalog-item.service';

/**
 * One catalogue item, read by identifier, as a domain that holds only the identifier receives it.
 *
 * The two members a caller publishes are `id` and the product's translated `name`, and the cases
 * below pin the three decisions that make the answer right rather than merely present:
 *
 * - **The name is the translation for the language the caller asked for**, defaulting to English when
 *   the request states none — the platform's own rule, applied here rather than a second one.
 * - **A product with no translation in that language has no name in it.** Falling back to another
 *   language would put a French name under an English request, which is a wrong answer rather than a
 *   missing one.
 * - **The row is returned, not a two-field projection of it**, so a caller that publishes the
 *   catalogue's own product or variant type finds the rest of that type's fields here. A variant has
 *   no name of its own, and none is borrowed from its product.
 *
 * Tenancy is asserted on both reads: an identifier that is not the caller's resolves to nothing, the
 * same answer an identifier that names nothing receives.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_ORG = 'organization-2';
const PRODUCT = 'product-1';
const FRENCH_ONLY_PRODUCT = 'product-french';
const VARIANT = 'variant-1';
const MISSING = 'does-not-exist';

/** One `product` row with its translations, as the read sees it. */
interface IProductRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	code: string;
	enabled: boolean;
	translations?: Array<{ languageCode: string; name: string; description?: string }>;
}

/** One `product_variant` row. */
interface IVariantRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	productId?: string;
	quantity?: number;
	internalReference?: string;
}

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row.
 */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
	return Object.entries(where).every(
		([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected ?? '')
	);
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

			const row = rows.filter((candidate) =>
				matches(candidate as Record<string, any>, stated.where as Record<string, any>)
			)[0];

			return row ? { ...row } : null;
		}
	};
}

/**
 * @param products The `product` rows.
 * @param variants The `product_variant` rows.
 * @returns The service, wired to the two doubles, and the doubles themselves.
 */
function fixture(products: IProductRow[] = [], variants: IVariantRow[] = []) {
	const productRepository = repository(products);
	const variantRepository = repository(variants);

	return {
		productRepository,
		variantRepository,
		service: new CatalogItemService(productRepository as never, variantRepository as never)
	};
}

/** The fixture product, named in English and French. */
const product = (overrides: Partial<IProductRow> = {}): IProductRow => ({
	id: PRODUCT,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'SKU-LESS-CODE',
	enabled: true,
	translations: [
		{ languageCode: LanguagesEnum.ENGLISH, name: 'Wool coat', description: 'A coat.' },
		{ languageCode: LanguagesEnum.FRENCH, name: 'Manteau de laine' }
	],
	...overrides
});

describe('CatalogItemService — one catalogue item, read by identifier', () => {
	afterEach(() => jest.restoreAllMocks());

	it('answers with the product and the name of the language the caller asked for', async () => {
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ headers: { language: 'fr' } } as never);
		const { service } = fixture([product()]);

		const item = await service.findProduct(PRODUCT);

		expect(item).toMatchObject({ id: PRODUCT, name: 'Manteau de laine' });
	});

	it('answers in English when the request states no language', async () => {
		const { service } = fixture([product()]);

		const item = await service.findProduct(PRODUCT);

		expect(item).toMatchObject({ id: PRODUCT, name: 'Wool coat', description: 'A coat.' });
	});

	it('answers with the row itself, so the fields of the catalogue’s own type resolve', async () => {
		// The port names two members; the row carries the rest of the type the caller publishes, and a
		// projection would leave those fields empty for no gain.
		const { service } = fixture([product()]);

		const item = await service.findProduct(PRODUCT);

		expect(item).toMatchObject({ code: 'SKU-LESS-CODE', enabled: true });
	});

	it('reports no name for a product that has no translation in the language asked for', async () => {
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ headers: { language: 'de' } } as never);
		const { service } = fixture([product()]);

		const item = await service.findProduct(PRODUCT);

		// The control is the product above: the same row answers with a name in a language it holds, and
		// with none in a language it does not — the name is never taken from another language.
		expect(item).toBeTruthy();
		expect(item).not.toHaveProperty('name');
	});

	it('answers with nothing for a product that is not the caller’s', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, productRepository } = fixture([product()]);

		expect(await service.findProduct(PRODUCT)).toBeNull();
		expect(productRepository.options[0]).toMatchObject({
			where: { id: PRODUCT, tenantId: TENANT, organizationId: OTHER_ORG }
		});
	});

	it('answers with nothing for an identifier that names no product', async () => {
		const { service } = fixture([product()]);

		expect(await service.findProduct(MISSING)).toBeNull();
	});

	it('answers with a variant’s own row and no borrowed name', async () => {
		const { service } = fixture([], [
			{ id: VARIANT, tenantId: TENANT, organizationId: ORG, productId: PRODUCT, quantity: 3, internalReference: 'COAT-L' }
		]);

		const item = await service.findVariant(VARIANT);

		// Nothing in the catalogue names a variant: the operator's own label is `internalReference`, and
		// the product's name is not the variant's.
		expect(item).toMatchObject({ id: VARIANT, internalReference: 'COAT-L', quantity: 3 });
		expect(item).not.toHaveProperty('name');
	});

	it('answers with nothing for a variant that is not the caller’s, or that does not exist', async () => {
		const mine = fixture([], [{ id: VARIANT, tenantId: TENANT, organizationId: ORG }]);
		const foreign = fixture([], [{ id: VARIANT, tenantId: TENANT, organizationId: OTHER_ORG }]);

		expect(await mine.service.findVariant(MISSING)).toBeNull();
		expect(await foreign.service.findVariant(VARIANT)).toBeNull();
	});

	it('refuses to answer when no identifier was named', async () => {
		const { service, productRepository, variantRepository } = fixture([product()]);

		await expect(service.findProduct(undefined as never)).rejects.toThrow(/CATALOG_PRODUCT_REQUIRED/);
		await expect(service.findVariant(undefined as never)).rejects.toThrow(/CATALOG_VARIANT_REQUIRED/);
		expect(productRepository.options).toEqual([]);
		expect(variantRepository.options).toEqual([]);
	});

	it('reads a French-only product by name when French is asked for', async () => {
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ headers: { language: 'fr' } } as never);
		const { service } = fixture([
			product({
				id: FRENCH_ONLY_PRODUCT,
				translations: [{ languageCode: LanguagesEnum.FRENCH, name: 'Manteau' }]
			})
		]);

		expect(await service.findProduct(FRENCH_ONLY_PRODUCT)).toMatchObject({ name: 'Manteau' });
	});
});
