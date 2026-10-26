/**
 * The soft-delete visibility of the entitlement domain's three list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired rows could not ask GraphQL for them at all.
 *
 * `@gauzy/core` boots the application graph from its barrel and `@gauzy/common` resolves the feature
 * catalogue at import time, neither of which a resolver needs; both are substituted at their module
 * boundary, as this package's controller spec does. The resolvers under test are the real ones, and the
 * kernel's connection helpers are real too — a double of those would let a page drift from the contract
 * in a suite that still passed.
 */
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a module graph. */
	const decorator = () => () => undefined;
	const connection = jest.requireActual('@gauzy/core/src/lib/api/graphql-connection');

	/**
	 * Every base class the entities the resolvers name extend, declared but never mapped onto a
	 * database: an entity is a class whose superclass has to exist for the module to load at all.
	 */
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
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		BaseEvent: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
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

// The collaborators a resolver injects, and the events it subscribes to, are doubled at their own
// modules so that nothing below them is loaded: what these cases assert is the options the field hands
// its service, not what it returns.
jest.mock('../../entitlement/entitlement.service', () => ({ EntitlementService: class EntitlementService {} }));
jest.mock('../../entitlement-activation/entitlement-activation.service', () => ({
	EntitlementActivationService: class EntitlementActivationService {}
}));
jest.mock('../../entitlement-key/entitlement-key.service', () => ({
	EntitlementKeyService: class EntitlementKeyService {}
}));
jest.mock('../../entitlement-check/entitlement-check.service', () => ({
	EntitlementCheckService: class EntitlementCheckService {}
}));
jest.mock('../../events/entitlement.events', () => ({
	EntitlementActivatedEvent: class EntitlementActivatedEvent {},
	EntitlementChangedEvent: class EntitlementChangedEvent {},
	EntitlementRevokedEvent: class EntitlementRevokedEvent {}
}));

import { ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { schemaExtensions } from '../schema-extensions';
import { EntitlementActivationResolver } from './entitlement-activation.resolver';
import { EntitlementKeyResolver } from './entitlement-key.resolver';
import { EntitlementResolver } from './entitlement.resolver';

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
const CONVERTED = ['entitlements', 'entitlementActivations', 'entitlementKeys'];

describe('the entitlement document — the list fields offer the soft-delete visibility the REST routes do', () => {
	it.each(CONVERTED)('declares `withDeleted: Boolean` on %s', (name) => {
		const field = queryFields().find((candidate) => candidate.name.value === name);

		if (!field) {
			throw new Error(`the entitlement document declares no Query field named "${name}"`);
		}

		const argument = field.arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('keeps the `page` argument the connections are walked with', () => {
		for (const name of CONVERTED) {
			const declared = (queryFields().find((candidate) => candidate.name.value === name)?.arguments ?? []).map(
				(argument) => argument.name.value
			);

			expect(declared).toContain('page');
		}
	});
});

describe('the entitlement resolvers — the flag reaches the read rather than being dropped at the field', () => {
	it('forwards it into `entitlements`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new EntitlementResolver(
			service as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.entitlements(undefined, undefined, true);
		await resolver.entitlements();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `entitlementActivations`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new EntitlementActivationResolver(service as never, unusedService() as never);

		await resolver.entitlementActivations(undefined, undefined, true);
		await resolver.entitlementActivations();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `entitlementKeys`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new EntitlementKeyResolver(service as never);

		await resolver.entitlementKeys(undefined, undefined, true);
		await resolver.entitlementKeys();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
