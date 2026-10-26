/**
 * The soft-delete visibility of the fulfilment domain's three list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired rows could not ask GraphQL for them at all.
 *
 * `@gauzy/core` boots the application graph from its barrel and `@gauzy/common` resolves the feature
 * catalogue at import time, neither of which a resolver needs; both are substituted at their module
 * boundary, as this package's controller spec does — including the base classes the entities the
 * resolvers name extend, because a class whose superclass is undefined cannot be loaded at all. The
 * resolvers under test are the real ones, and the kernel's connection helpers are real too: a double
 * of those would let a page drift from the contract in a suite that still passed.
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
		Warehouse: class Warehouse {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		VERSION_EXPECTATION_PROPERTY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util')
			.VERSION_EXPECTATION_PROPERTY,
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
jest.mock('../fulfillment/fulfillment.service', () => ({ FulfillmentService: class FulfillmentService {} }));
jest.mock('../fulfillment-line/fulfillment-line.service', () => ({
	FulfillmentLineService: class FulfillmentLineService {}
}));
jest.mock('../shipping-option/shipping-option.service', () => ({
	ShippingOptionService: class ShippingOptionService {}
}));
jest.mock('../shipping-profile/shipping-profile.service', () => ({
	ShippingProfileService: class ShippingProfileService {}
}));

import { ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { fulfillmentSchemaExtensions } from './schema-extensions';
import { FulfillmentResolver } from './fulfillment.resolver';
import { ShippingOptionResolver } from './shipping-option.resolver';

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
			findAll: async (options: Record<string, any> = {}) => {
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
	const query = fulfillmentSchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Query'
	);

	return query?.fields ?? [];
}

/** The three fields the REST surface already lets a caller ask for retired rows on. */
const CONVERTED = ['shippingProfiles', 'shippingOptions', 'fulfillments'];

describe('the fulfilment document — the list fields offer the soft-delete visibility the REST routes do', () => {
	it.each(CONVERTED)('declares `withDeleted: Boolean` on %s', (name) => {
		const field = queryFields().find((candidate) => candidate.name.value === name);

		if (!field) {
			throw new Error(`the fulfilment document declares no Query field named "${name}"`);
		}

		const argument = field.arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('keeps the arguments the three fields already carried', () => {
		for (const name of CONVERTED) {
			const declared = (queryFields().find((candidate) => candidate.name.value === name)?.arguments ?? []).map(
				(argument) => argument.name.value
			);

			expect(declared).toContain('page');
		}

		// The four filters `fulfillments` narrows by, none of which the conversion may have dropped.
		expect(
			(queryFields().find((candidate) => candidate.name.value === 'fulfillments')?.arguments ?? []).map(
				(argument) => argument.name.value
			)
		).toEqual(expect.arrayContaining(['orderId', 'status', 'warehouseId', 'direction']));
	});
});

describe('the fulfilment resolvers — the flag reaches the read rather than being dropped at the field', () => {
	it('forwards it into `shippingProfiles`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new ShippingOptionResolver(unusedService() as never, service as never);

		await resolver.shippingProfiles(undefined, true);
		await resolver.shippingProfiles();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `shippingOptions`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new ShippingOptionResolver(service as never, unusedService() as never);

		await resolver.shippingOptions(undefined, true);
		await resolver.shippingOptions();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `fulfillments`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new FulfillmentResolver(service as never, unusedService() as never);

		await resolver.fulfillments(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.fulfillments();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
