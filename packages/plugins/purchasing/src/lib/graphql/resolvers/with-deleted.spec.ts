/**
 * The soft-delete visibility of the purchasing domain's three list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired rows could not ask GraphQL for them at all.
 *
 * `@gauzy/core` boots the application graph from its barrel and `@gauzy/common` resolves the feature
 * catalogue at import time, neither of which a resolver needs; both are substituted at their module
 * boundary, as this package's controller spec does — including the base classes and the related classes
 * the entities the resolvers name reference, because a class whose superclass is undefined cannot be
 * loaded at all. The resolvers under test are the real ones, and the kernel's connection helpers are
 * real too: a double of those would let a page drift from the contract in a suite that still passed.
 */
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a module graph. */
	const decorator = () => () => undefined;
	const connection = jest.requireActual('@gauzy/core/src/lib/api/graphql-connection');

	class BaseEntity {}
	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	return {
		Permissions: decorator,
		Idempotent: decorator,
		Versioned: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		EventBus: class {},
		BaseEvent: class {},
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Warehouse: class Warehouse {},
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		DEFAULT_CONNECTION_PAGE_SIZE: connection.DEFAULT_CONNECTION_PAGE_SIZE,
		MAX_CONNECTION_PAGE_SIZE: connection.MAX_CONNECTION_PAGE_SIZE,
		resolveConnectionWindow: connection.resolveConnectionWindow,
		connectionFromOffsetPage: connection.connectionFromOffsetPage,
		decodeOffsetCursor: connection.decodeOffsetCursor,
		encodeOffsetCursor: connection.encodeOffsetCursor,
		paginateRows: connection.paginateRows
	};
});

// The collaborators a resolver injects are doubled at their own modules, so nothing below them is
// loaded: what these cases assert is the options the field hands its service, not what it returns.
jest.mock('../../purchase-order/purchase-order.service', () => ({
	PurchaseOrderService: class PurchaseOrderService {}
}));
jest.mock('../../purchase-order-line/purchase-order-line.service', () => ({
	PurchaseOrderLineService: class PurchaseOrderLineService {}
}));
jest.mock('../../goods-receipt/goods-receipt.service', () => ({ GoodsReceiptService: class GoodsReceiptService {} }));
jest.mock('../../goods-receipt-line/goods-receipt-line.service', () => ({
	GoodsReceiptLineService: class GoodsReceiptLineService {}
}));
jest.mock('../../vendor-product-term/vendor-product-term.service', () => ({
	VendorProductTermService: class VendorProductTermService {}
}));

import { ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { schemaExtensions } from '../schema-extensions';
import { GoodsReceiptResolver } from './goods-receipt.resolver';
import { PurchaseOrderResolver } from './purchase-order.resolver';
import { VendorProductTermResolver } from './vendor-product-term.resolver';

/** One page, as a service double answers it. */
const EMPTY_PAGE = { items: [], total: 0 };

/**
 * A service double that records the options it was handed.
 *
 * @returns The double and the options it received, in order.
 */
function recordingService(): { service: Record<string, unknown>; calls: Array<Record<string, any>> } {
	const calls: Array<Record<string, any>> = [];

	return {
		calls,
		service: {
			findAll: async (options: Record<string, any>) => {
				calls.push(options);

				return EMPTY_PAGE;
			}
		}
	};
}

/** A service nothing in these cases is expected to call. */
const unusedService = (): Record<string, unknown> => ({});

/** The root query type's own field declarations, as the document spells them. */
function queryFields(): ReadonlyArray<{ name: { value: string }; arguments?: ReadonlyArray<any> }> {
	const query = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Query'
	);

	return query?.fields ?? [];
}

/** The three fields the REST surface already lets a caller ask for retired rows on. */
const CONVERTED = ['purchaseOrders', 'goodsReceipts', 'vendorProductTerms'];

describe('the purchasing document — the list fields offer the soft-delete visibility the REST routes do', () => {
	it.each(CONVERTED)('declares `withDeleted: Boolean` on %s', (name) => {
		const field = queryFields().find((candidate) => candidate.name.value === name);

		if (!field) {
			throw new Error(`the purchasing document declares no Query field named "${name}"`);
		}

		const argument = field.arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('keeps the `filter` and `page` arguments the three fields already carried', () => {
		for (const name of CONVERTED) {
			const declared = (queryFields().find((candidate) => candidate.name.value === name)?.arguments ?? []).map(
				(argument) => argument.name.value
			);

			expect(declared).toEqual(expect.arrayContaining(['filter', 'page']));
		}
	});
});

describe('the purchasing resolvers — the flag reaches the read rather than being dropped at the field', () => {
	it('forwards it into `purchaseOrders`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new PurchaseOrderResolver(
			service as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.purchaseOrders(undefined, undefined, true);
		await resolver.purchaseOrders();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `goodsReceipts`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new GoodsReceiptResolver(service as never, unusedService() as never);

		await resolver.goodsReceipts(undefined, undefined, true);
		await resolver.goodsReceipts();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `vendorProductTerms`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new VendorProductTermResolver(service as never);

		await resolver.vendorProductTerms(undefined, undefined, true);
		await resolver.vendorProductTerms();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
