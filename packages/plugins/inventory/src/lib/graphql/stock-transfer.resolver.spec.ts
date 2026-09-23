/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a GraphQL resolver needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the surfaces under test are the real ones**: the transfer controller and the
 * transfer resolver, bound to a stubbed service so what each of them delegates to is asserted rather
 * than inferred.
 *
 * The permission decorator is doubled with the platform’s own metadata key, read from the platform’s
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator’s prose. The entity-tag parser is the kernel’s own file rather than a
 * restatement of it, for the reason the transfer service suite states: the routes under test read
 * `If-Match` with it, and a parser written here would let the suite agree with itself about a header
 * the platform does not parse that way.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const { parseIfMatch } = jest.requireActual('../../../../../core/src/lib/concurrency/version.util');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class the
		// resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UseValidationPipe: decorator,
		// The two conventions the decorated routes carry. Both are decorator factories and nothing more:
		// the guard and the interceptor they attach are application providers, and a unit test that never
		// boots the application never runs them.
		Versioned: () => () => undefined,
		Idempotent: () => () => undefined,
		// The controller reads the version precondition through the barrel, so the kernel's own parser is
		// what answers: the routes are asserted to follow the platform's reading of `If-Match`.
		parseIfMatch,
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		RequestContext: {
			currentRequest: () => null,
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		// The three the package's list fields answer connections through. They are the kernel's own
		// implementations rather than stand-ins written here, for the same reason the parser above is.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { print } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { StockTransferController } from '../stock-transfer/stock-transfer.controller';
import { inventorySchemaExtensions } from './inventory.schema';
import { StockTransferResolver } from './stock-transfer.resolver';

/**
 * The transfer transitions a client can reach, over both protocols (doc 17 §3.1).
 *
 * §3.1 asks for **capability parity**, not shape parity: one mutation per REST write route, the same
 * permission per operation, and the same service call behind it. The transfer resource was served over
 * GraphQL for drafting, editing, dispatching, receiving and cancelling, but not for the two transitions
 * that move a document out of `DRAFT`: a client on the GraphQL surface could create a transfer and
 * never submit or release it, and the absence read as a client error rather than as a missing surface,
 * because a root field the schema does not declare is refused before any resolver is consulted.
 *
 * The suite pins the three halves of the parity that are easy to get quietly wrong:
 *
 * - the field exists in this package's schema contribution **and** on the `Mutation` root, because a
 *   field declared anywhere else is a field no client can call;
 * - it states the permission **its own route** states — `STOCK_TRANSFER_CREATE` for the submission and
 *   `STOCK_TRANSFER_APPROVE` for the release — rather than the class-level read grant it would inherit
 *   if the handler declared none, which is the shape of the defect the programme's parity rule exists
 *   to catch;
 * - calling it reaches the same service method with the same arguments the route reaches, so the two
 *   protocols are one implementation and not two that can drift.
 */

/** The transfer the transitions are attempted on. Nothing reads it; it only has to be stated. */
const TRANSFER = '00000000-0000-4000-8000-000000000050';

/** What the submission answers with, so the two surfaces can be compared by identity. */
const REQUESTED = { id: TRANSFER, status: 'REQUESTED', version: 2 };

/** And what the approval answers with. */
const APPROVED = { id: TRANSFER, status: 'APPROVED', version: 3 };

/**
 * Builds the two surfaces over one stubbed service.
 *
 * The service is the seam the doctrine is about: both protocols must reach the same method, so a stub
 * is what makes that visible without a database behind it.
 */
function surfaces() {
	const service = {
		request: jest.fn().mockResolvedValue(REQUESTED),
		approve: jest.fn().mockResolvedValue(APPROVED)
	};
	const eventBus = { ofType: () => ({ pipe: () => 'the transfer stream' }) };

	return {
		service,
		controller: new StockTransferController(service as never),
		resolver: new StockTransferResolver(service as never, eventBus as never)
	};
}

/** The schema document, as text, so a field can be asserted the way a client reads it. */
const schemaText = print(inventorySchemaExtensions);

/**
 * The body of a root type's declaration, so a field can be asserted to sit on the root it belongs to.
 *
 * A `[\s\S]*` between two names is not the same question: every root field of this document follows
 * its query block, so a pattern spanning from the query root to a mutation's name matches whatever the
 * document declares in between. Reading the block is what makes "this transition is not offered as a
 * read" a statement about the query root rather than about the length of the document.
 */
function rootBody(name: string): string {
	const start = schemaText.search(new RegExp(`(?:extend\\s+)?type\\s+${name}\\b[^{]*\\{`));

	if (start === -1) {
		throw new Error(`the inventory document declares no root type named "${name}"`);
	}

	const open = schemaText.indexOf('{', start);
	let depth = 0;

	for (let index = open; index < schemaText.length; index++) {
		if (schemaText[index] === '{') depth++;
		else if (schemaText[index] === '}') {
			depth--;

			if (depth === 0) {
				return schemaText.slice(open + 1, index);
			}
		}
	}

	throw new Error(`the declaration of "${name}" is not brace-balanced`);
}

describe('StockTransferResolver — the submission and the approval (doc 17 §3.1)', () => {
	it('submits through the same service method the REST route calls, with the arguments the route states', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.request(TRANSFER);
		const overGraphql = await resolver.requestStockTransfer(TRANSFER);

		// One method, two callers, and the same argument: the id. The version both leave absent is the
		// one the route would have read from `If-Match` — absent there because no header was sent, and
		// absent from the field because a field has no header to read — so a request that states no
		// precondition is what each of them forwards.
		expect(service.request).toHaveBeenCalledTimes(2);
		expect(service.request.mock.calls.map((call) => call[0])).toEqual([TRANSFER, TRANSFER]);
		expect(service.request.mock.calls.map((call) => call[1])).toEqual([undefined, undefined]);
		// One answer, one implementation: the two protocols are not two ways of doing the same thing.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(REQUESTED);
	});

	it('approves through the same service method the REST route calls, with the arguments the route states', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.approve(TRANSFER);
		const overGraphql = await resolver.approveStockTransfer(TRANSFER);

		expect(service.approve).toHaveBeenCalledTimes(2);
		expect(service.approve.mock.calls.map((call) => call[0])).toEqual([TRANSFER, TRANSFER]);
		expect(service.approve.mock.calls.map((call) => call[1])).toEqual([undefined, undefined]);
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(APPROVED);
	});

	it('states each route’s own permission, and neither transition rides the other’s grant', () => {
		// What a guard reads: the handler’s own metadata when it declares one, the class’s metadata
		// otherwise. The class carries the read grant, so every transition has to state its own — a
		// handler that declared none would be reachable by any caller who may look at a transfer. The
		// values are asserted as the strings themselves, because a string is what the guard compares.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferResolver)).toEqual(['STOCK_VIEW']);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferResolver.prototype.requestStockTransfer)).toEqual(
			['STOCK_TRANSFER_CREATE']
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferResolver.prototype.approveStockTransfer)).toEqual(
			['STOCK_TRANSFER_APPROVE']
		);

		// And the REST routes state the same two values, which is the whole of the authorisation parity:
		// the submission is the drafting authority and the approval is the releasing one, so a role that
		// holds only the first cannot release a transfer by asking GraphQL instead of REST.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferController.prototype.request)).toEqual([
			'STOCK_TRANSFER_CREATE'
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferController.prototype.approve)).toEqual([
			'STOCK_TRANSFER_APPROVE'
		]);

		// The two grants are distinct, and the fields state them apart: a field that restated one value
		// for both transitions would let the operator who drafts a transfer release it as well, which is
		// the separation the two REST permissions exist to keep.
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferResolver.prototype.approveStockTransfer)
		).not.toEqual(Reflect.getMetadata(PERMISSIONS_METADATA, StockTransferResolver.prototype.requestStockTransfer));
	});

	it('guards both surfaces with the tenant and permission guards', () => {
		for (const surface of [StockTransferResolver, StockTransferController]) {
			const guards = Reflect.getMetadata('__guards__', surface) ?? [];

			expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		}
	});
});

describe('StockTransferResolver — the two transitions in the schema document', () => {
	it('declares both on the Mutation root, with the arguments the fields read', () => {
		// The field has to exist where a client looks for a write. A mutation declared in this package's
		// contribution but not on the `Mutation` root — or declared with an argument the resolver does not
		// read, or read by the resolver and not declared — is a field the endpoint either refuses or
		// answers while ignoring half of what was asked.
		const mutation = rootBody('Mutation');

		expect(mutation).toContain('requestStockTransfer(id: ID!): StockTransfer!');
		expect(mutation).toContain('approveStockTransfer(id: ID!): StockTransfer!');

		// Neither transition states a version, because neither route can state one over GraphQL: the
		// precondition is the `If-Match` header, and a field that accepted a `version` argument would be
		// declaring a precondition the resolver never reads.
		expect(mutation).not.toMatch(/requestStockTransfer\([^)]*version/);
		expect(mutation).not.toMatch(/approveStockTransfer\([^)]*version/);

		// And neither is offered as a read: a transition on the query root would be reachable by every
		// caller who may look at a transfer, under the read permission the query root runs on.
		const query = rootBody('Query');

		expect(query).not.toContain('requestStockTransfer');
		expect(query).not.toContain('approveStockTransfer');
	});
});
