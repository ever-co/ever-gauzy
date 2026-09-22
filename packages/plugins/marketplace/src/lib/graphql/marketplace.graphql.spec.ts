/**
 * The marketplace's GraphQL contribution, as the platform composes it.
 *
 * A package's GraphQL surface has two halves, and it fails silently without either one. The schema
 * document declares the fields; the resolvers answer them. A field a resolver declares while the
 * schema does not is never served, and a figure a service hands back while the schema does not
 * declare it is unreachable over GraphQL although REST serves it — which is how a whole package's
 * GraphQL surface came to be absent while the contract gate, which only asks whether a package *has*
 * resolvers, stayed green.
 *
 * This specification pins the invariant rather than the document. It reads the resolver's own
 * declarations, composes them into a schema, calls the resolver with in-memory doubles of its six
 * services, and asserts that what the resolvers declare and what those services hand back are one
 * surface. The SDL text is never restated: a field added to the schema without a row that carries it
 * fails, and a row that carries a field the schema does not declare fails too.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which this seam needs, so it is doubled at the module
 * boundary, exactly as the package's other specifications do. `@gauzy/plugin` is left real: the
 * extension the plugin declares is read back the way the runtime reads it.
 */
jest.mock('@gauzy/core', () => {
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

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		// `@UsePipes(new AbstractValidationPipe(…))` runs when the controller class is defined, and Nest
		// refuses a pipe without `transform`; the double carries both so the suite can load.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		CrudService: class {},
		CrudController: class {},
		TenantAwareCrudService,
		MikroOrmBaseEntityRepository: class {},
		EventBus: class {},
		BaseEvent: class {},
		EventOutboxService: class {},
		EventOutboxModule: class {},
		RolePermissionModule: class {},
		SequenceService: class {},
		SequenceModule: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		ColumnIndex: decorator,
		JsonColumn: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		IsSecret: decorator,
		Permissions: () => () => undefined,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {},
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The decimal comparison the commission bands and the settlement's discrepancy are decided by is
		// the kernel's own, so the double hands over the real one: a comparison doubled here would agree
		// with the service about arithmetic the platform never performs.
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		// The retry-safety declaration is read back here, so the decorator that writes it and the key it
		// writes it under are the kernel's own rather than a second copy of either.
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// The offering controller declares a bulk route and the mutation that mirrors it runs the same
		// batch from that declaration, so the decorator, its reader and the executor are the kernel's own:
		// a doubled reader would agree with a resolver while disagreeing with the controller.
		BulkOperation: jest.requireActual('@gauzy/core/src/lib/api/bulk.decorator').BulkOperation,
		bulkOptionsOf: jest.requireActual('@gauzy/core/src/lib/api/bulk.decorator').bulkOptionsOf,
		BulkExecutor: jest.requireActual('@gauzy/core/src/lib/api/bulk-executor.service').BulkExecutor,
		// The per-item projection both surfaces answer with is the kernel's own, so the payload the resolver
		// assembles here is the projection the REST body carries rather than a second rendering of it.
		toBulkItemOutcomes: jest.requireActual('@gauzy/core/src/lib/api/bulk').toBulkItemOutcomes,
		// The three helpers the six converted list fields page and answer with are the kernel's own. A
		// double that stubbed them would let a connection drift from the contract — a count that is not the
		// filtered total, a window that is off by a page — in a suite that still passed, which is the whole
		// class of defect this conversion removed.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

/**
 * The batch executor names the field-visibility service in its constructor, and importing that class
 * reaches the whole core persistence layer — the request context, its configuration and the token
 * libraries — none of which a batch needs. The seam therefore doubles the module behind the name as well,
 * exactly as the payout surface's specification doubles the kernel's key store: the executor is the real
 * one here, and the visibility it authorises through is the in-memory predicate below.
 */
jest.mock('@gauzy/core/src/lib/api/field-visibility.service', () => ({ FieldVisibility: class {} }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import {
	buildSchema,
	extendSchema,
	getNamedType,
	GraphQLEnumType,
	GraphQLInputObjectType,
	GraphQLObjectType,
	isNonNullType,
	Kind,
	parse,
	print
} from 'graphql';
import type { GraphQLArgument, GraphQLField, GraphQLInputField } from 'graphql';
import {
	CommissionBasis,
	OfferingCondition,
	OfferingFulfilmentMode,
	OfferingStatus,
	SellerHoldReason,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerSettlementStatus,
	SellerStatus,
	SellerTransactionKind,
	SellerTransactionStatus,
	SellerVerificationStatus,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';
import { getPluginExtensions } from '@gauzy/plugin';
import { BulkExecutor, IDEMPOTENT_METADATA_KEY } from '@gauzy/core';
import { MarketplaceModule } from '../marketplace.module';
import { MarketplacePlugin } from '../marketplace.plugin';
import { SellerOfferingController } from '../seller-offering/seller-offering.controller';
import { SellerOfferingBulkOperation } from '../seller-offering/seller-offering.bulk';
import { SellerPayoutController } from '../seller-payout/seller-payout.controller';
import { SellerSettlementController } from '../seller-settlement/seller-settlement.controller';
import { SellerTransactionController } from '../seller-transaction/seller-transaction.controller';
import { SellerController } from '../seller/seller.controller';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';
import * as graphqlSurface from './index';
import { SellerEntityResolver } from './marketplace.resolver';
import { schemaExtensions } from './schema-extensions';

/* ------------------------------------------------------------------------------------------------
 * Reading the contribution
 * ---------------------------------------------------------------------------------------------- */

/** The resolver's own source, which is where its root fields are declared. */
const RESOLVER_SOURCE = readFileSync(join(__dirname, 'marketplace.resolver.ts'), 'utf8');

/** The plugin's extensions, read the way the runtime reads them. */
const EXTENSIONS = getPluginExtensions([MarketplacePlugin]) as Array<{ schema?: any; resolvers?: any[] }>;
const CONTRIBUTED_SCHEMA = EXTENSIONS[0]?.schema;
const CONTRIBUTED_RESOLVERS: unknown[] = EXTENSIONS[0]?.resolvers ?? [];

/** Every resolver class the package's GraphQL barrel exports. */
const EXPORTED_RESOLVERS = Object.entries(graphqlSurface)
	.filter(([name, value]) => name.endsWith('Resolver') && typeof value === 'function')
	.map(([, value]) => value);

/**
 * The platform's own contribution, reduced to what the marketplace references.
 *
 * The kernel declares the scalars, the `UserError` every payload that reports an expected outcome carries,
 * the connection protocol's `PageInput` and `PageInfo`, and the three root operation types; a plugin
 * extends the roots and may never redeclare a type. Composing against this stub is what makes the
 * assertion runnable with no container, no database and no configuration — the same sequence the boot
 * performs, on the part of the schema this package is responsible for.
 */
const PLATFORM_STUB = `
	scalar DateTime
	scalar Decimal
	scalar JSON

	type UserError {
		code: String!
		message: String!
		path: [String!]
		details: JSON
	}

	input PageInput {
		first: Int
		after: String
		last: Int
		before: String
	}

	type PageInfo {
		hasNextPage: Boolean!
		hasPreviousPage: Boolean!
		startCursor: String
		endCursor: String
	}

	type Query {
		_thePlatform: Boolean
	}

	type Mutation {
		_thePlatform: Boolean
	}
`;

/** The schema the marketplace contributes to, composed the way the boot composes it. */
const COMPOSED = extendSchema(buildSchema(PLATFORM_STUB), CONTRIBUTED_SCHEMA);

/** One root field a resolver declares. */
interface DeclaredField {
	operation: 'Query' | 'Mutation';
	field: string;
	method: string;
}

/**
 * The index of the parenthesis that closes the one at `open`, or -1.
 *
 * Read by counting rather than by matching, because a `@Query` argument holds an arrow function and
 * therefore parentheses of its own.
 */
function matchingParenthesis(source: string, open: number): number {
	let depth = 0;

	for (let index = open; index < source.length; index++) {
		const character = source[index];
		if (character === '(') depth++;
		else if (character === ')') {
			depth--;
			if (depth === 0) return index;
		}
	}

	return -1;
}

/** The method a decorator is attached to, skipping any further decorators between the two. */
function methodAfter(source: string, from: number): string | undefined {
	let index = from;

	for (;;) {
		const decorator = /^\s*@([A-Za-z_]\w*)\s*\(/.exec(source.slice(index));
		if (!decorator) break;

		const close = matchingParenthesis(source, index + decorator[0].length - 1);
		if (close === -1) return undefined;
		index = close + 1;
	}

	return /^\s*(?:\/\/[^\n]*\n\s*)*(?:public\s+|async\s+)*([A-Za-z_]\w*)\s*\(/.exec(source.slice(index))?.[1];
}

/** Every root field the resolver declares, read from the decorators that declare them. */
function declaredFields(source: string): DeclaredField[] {
	const fields: DeclaredField[] = [];

	for (const operation of ['Query', 'Mutation'] as const) {
		const marker = `@${operation}(`;

		for (let index = source.indexOf(marker); index !== -1; index = source.indexOf(marker, index + 1)) {
			const close = matchingParenthesis(source, index + marker.length - 1);
			if (close === -1) continue;

			const argument = source.slice(index + marker.length, close);
			const field = /name:\s*['"`]([A-Za-z_]\w*)['"`]/.exec(argument)?.[1];
			const method = methodAfter(source, close + 1);
			if (!field || !method) continue;

			fields.push({ operation, field, method });
		}
	}

	return fields;
}

/** The root fields the schema extension itself declares, read from its own document. */
function extendedFields(document: any): DeclaredField[] {
	const fields: DeclaredField[] = [];

	for (const definition of document.definitions) {
		const extension =
			definition.kind === Kind.OBJECT_TYPE_EXTENSION &&
			(definition.name.value === 'Query' || definition.name.value === 'Mutation');
		if (!extension) continue;

		for (const field of definition.fields ?? []) {
			fields.push({ operation: definition.name.value, field: field.name.value, method: field.name.value });
		}
	}

	return fields;
}

const DECLARED = declaredFields(RESOLVER_SOURCE);
const EXTENDED = extendedFields(CONTRIBUTED_SCHEMA);

/* ------------------------------------------------------------------------------------------------
 * The rows the resolvers hand back
 * ---------------------------------------------------------------------------------------------- */

/**
 * One row per aggregate, in the shape its own entity carries.
 *
 * A field the column leaves empty is written as `undefined` rather than omitted, because the point of
 * these fixtures is that the key exists: a schema field whose row has no such property is a null a
 * client cannot tell from an absent value, which is the failure this file exists to catch.
 */
const SELLER: Record<string, unknown> = {
	id: 'seller-1',
	code: 'SELL-1',
	name: 'Seller One',
	legalName: 'Seller One Limited',
	email: 'seller@example.test',
	phone: '+10000000000',
	contactId: 'contact-1',
	status: SellerStatus.ACTIVE,
	businessVerificationStatus: SellerVerificationStatus.VERIFIED,
	taxVerificationStatus: SellerVerificationStatus.VERIFIED,
	payoutAccountStatus: SellerVerificationStatus.VERIFIED,
	verificationExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
	taxCountryCode: 'US',
	taxCollectionMode: TaxCollectionMode.MARKETPLACE_COLLECTS_AND_REMITS,
	defaultCommissionRate: '0.150000',
	commissionBasis: CommissionBasis.ITEM_SUBTOTAL,
	payoutMode: SellerPayoutMode.PROVIDER_TRANSFER,
	payoutSchedule: SellerPayoutSchedule.MONTHLY,
	payoutCurrency: 'USD',
	payoutThreshold: '50.000000',
	reservePercent: '0.050000',
	payoutHoldDays: 7,
	activatedAt: new Date('2026-01-01T00:00:00.000Z'),
	suspendedAt: undefined,
	suspensionReason: undefined
};

const OFFERING: Record<string, unknown> = {
	id: 'offering-1',
	sellerId: 'seller-1',
	variantId: 'variant-1',
	productId: 'product-1',
	sellerSku: 'SELL-1-SKU',
	title: 'An offering',
	condition: OfferingCondition.NEW,
	priceAmount: '19.990000',
	priceCurrency: 'USD',
	commissionRate: '0.120000',
	status: OfferingStatus.ACTIVE,
	channelIds: ['channel-1'],
	availableFrom: new Date('2026-01-01T00:00:00.000Z'),
	availableTo: undefined,
	fulfilmentMode: OfferingFulfilmentMode.PLATFORM,
	isFeatured: false
};

const TRANSACTION: Record<string, unknown> = {
	id: 'transaction-1',
	sellerId: 'seller-1',
	orderId: 'order-1',
	orderLineId: 'order-line-1',
	kind: SellerTransactionKind.SALE,
	status: SellerTransactionStatus.SETTLEABLE,
	currency: 'USD',
	grossAmount: '19.990000',
	taxAmount: '1.600000',
	sellerDiscountAmount: '0.000000',
	platformDiscountAmount: '-2.000000',
	commissionBasis: CommissionBasis.ITEM_SUBTOTAL,
	commissionBasisAmount: '19.990000',
	commissionRate: '0.150000',
	commissionAmount: '2.998500',
	netAmount: '18.591500',
	occurredAt: new Date('2026-02-01T00:00:00.000Z'),
	settleableAt: new Date('2026-02-08T00:00:00.000Z'),
	holdReason: undefined,
	reversesTransactionId: undefined
};

const PAYOUT_LINE: Record<string, unknown> = {
	id: 'payout-line-1',
	sellerPayoutId: 'payout-1',
	sellerTransactionId: 'transaction-1',
	amount: '18.591500',
	currency: 'USD'
};

const PAYOUT: Record<string, unknown> = {
	id: 'payout-1',
	sellerId: 'seller-1',
	number: 'PAY-0001',
	status: SellerPayoutStatus.PENDING,
	payoutMode: SellerPayoutMode.PROVIDER_TRANSFER,
	currency: 'USD',
	netAmount: '18.591500',
	feeAmount: '0.000000',
	reserveAmount: '0.929575',
	paidAmount: '17.661925',
	isFinal: false,
	paidAt: undefined,
	providerKey: 'provider-1',
	providerTransferId: undefined,
	lines: [PAYOUT_LINE]
};

const SETTLEMENT: Record<string, unknown> = {
	id: 'settlement-1',
	sellerId: 'seller-1',
	providerKey: 'provider-1',
	status: SellerSettlementStatus.OPEN,
	currency: 'USD',
	grossAmount: '100.000000',
	commissionAmount: '15.000000',
	feeAmount: '1.000000',
	netAmount: '84.000000',
	discrepancyAmount: '0.000000',
	closedAt: undefined
};

const BALANCE: Record<string, unknown> = {
	currency: 'USD',
	available: '18.591500',
	pending: '0.000000',
	held: '0.000000',
	negativeCarryForward: '0.000000',
	reserveNextRun: '0.929575',
	nextPayoutAt: new Date('2026-03-01T00:00:00.000Z')
};

const STATEMENT_LINE: Record<string, unknown> = {
	transactionId: 'transaction-1',
	kind: SellerTransactionKind.SALE,
	status: SellerTransactionStatus.SETTLEABLE,
	occurredAt: new Date('2026-02-01T00:00:00.000Z'),
	description: 'One sale',
	grossAmount: '19.990000',
	commissionAmount: '2.998500',
	netAmount: '18.591500',
	currency: 'USD'
};

const STATEMENT: Record<string, unknown> = {
	sellerId: 'seller-1',
	currency: 'USD',
	from: new Date('2026-02-01T00:00:00.000Z'),
	to: new Date('2026-03-01T00:00:00.000Z'),
	openingBalance: '0.000000',
	lines: [STATEMENT_LINE],
	payouts: [PAYOUT],
	settlements: [SETTLEMENT],
	closingBalance: '18.591500',
	negativeCarryForward: '0.000000',
	reserveNextRun: '0.929575',
	nextPayoutAt: new Date('2026-03-01T00:00:00.000Z')
};

const RECONCILIATION: Record<string, unknown> = {
	orderId: 'order-1',
	currency: 'USD',
	capturedAmount: '18.591500',
	platformOwnCaptured: '0.000000',
	sumNet: '18.591500',
	sumCommission: '2.998500',
	platformDiscount: '2.000000',
	splitDelta: '0.000000',
	platformRetained: '4.998500'
};

/**
 * The six services and the batch executor, doubled.
 *
 * Each service returns the row its own aggregate carries, so a resolver method under test is the real one
 * and the only thing invented here is the store it reads. The batch executor is the kernel's own — a
 * doubled one would agree with the resolver while disagreeing with the route that declares the batch — and
 * the two members it reads from the platform are doubled: the visibility it authorises the whole request
 * through, and the service an item of this resource reaches.
 */
function createResolver(): SellerEntityResolver {
	const sellerService = {
		listSellers: async () => ({ items: [SELLER], total: 1 }),
		getSeller: async () => SELLER,
		getStatement: async () => STATEMENT,
		getBalance: async () => BALANCE,
		submit: async () => SELLER,
		activate: async () => SELLER,
		suspend: async () => SELLER,
		reinstate: async () => SELLER
	};

	const sellerOfferingService = {
		listOfferings: async () => ({ items: [OFFERING], total: 1 }),
		publish: async () => OFFERING,
		unpause: async () => OFFERING,
		withdraw: async () => OFFERING,
		applyBulkItem: async (item: { id: string }) => ({ ...OFFERING, id: item.id }),
		transaction: async (work: (manager: unknown) => Promise<unknown>) => await work(undefined)
	};

	const sellerTransactionService = {
		listTransactions: async () => ({ items: [TRANSACTION], total: 1 }),
		reconcile: async () => ({ items: [RECONCILIATION], total: 1 }),
		settle: async () => TRANSACTION,
		hold: async () => TRANSACTION
	};

	const sellerPayoutService = {
		listPayouts: async () => ({ items: [PAYOUT], total: 1 }),
		getPayout: async () => PAYOUT,
		createPayout: async () => PAYOUT,
		approve: async () => PAYOUT,
		recordExecution: async () => PAYOUT,
		cancel: async () => ({ payout: PAYOUT, releasedTransactionCount: 1 })
	};

	const sellerPayoutLineService = {
		listLines: async () => ({ items: [PAYOUT_LINE], total: 1 })
	};

	const sellerSettlementService = {
		listSettlements: async () => ({ items: [SETTLEMENT], total: 1 }),
		record: async () => SETTLEMENT
	};

	const visibility = { assertCanSee: () => undefined, canSee: () => true };

	return new SellerEntityResolver(
		sellerService as any,
		sellerOfferingService as any,
		sellerTransactionService as any,
		sellerPayoutService as any,
		sellerPayoutLineService as any,
		sellerSettlementService as any,
		new BulkExecutor(visibility as never)
	);
}

/**
 * The same six services, recording the scope each call was made with.
 *
 * The assertion the fixture exists for is not "a method ran" but "the scope reached the service that
 * narrows by it": every one of these methods only narrows when it is handed a scope, so a field that
 * called it without one runs unscoped and looks identical from the outside.
 *
 * @param calls Where each call records the service method it reached and the scope it carried.
 * @returns A resolver over the recording doubles.
 */
function recordingResolver(calls: Array<{ field: string; scope?: ISellerScope }>): any {
	const record =
		(field: string, answer: unknown, position = 1) =>
		(...args: unknown[]) => {
			calls.push({ field, scope: args[position] as ISellerScope });

			return Promise.resolve(answer);
		};

	const sellerService = {
		listSellers: record('listSellers', { items: [SELLER], total: 1 }),
		getSeller: record('getSeller', SELLER),
		getStatement: record('getStatement', STATEMENT, 2),
		getBalance: async () => BALANCE,
		submit: record('submit', SELLER),
		activate: record('activate', SELLER),
		suspend: record('suspend', SELLER, 2),
		reinstate: record('reinstate', SELLER)
	};

	const sellerOfferingService = {
		listOfferings: record('listOfferings', { items: [OFFERING], total: 1 }),
		publish: record('publish', OFFERING, 2),
		unpause: record('unpause', OFFERING),
		withdraw: record('withdraw', OFFERING),
		applyBulkItem: record('applyBulkItem', OFFERING),
		transaction: async (work: (manager: unknown) => Promise<unknown>) => await work(undefined)
	};

	const sellerTransactionService = {
		listTransactions: record('listTransactions', { items: [TRANSACTION], total: 1 }),
		reconcile: record('reconcile', { items: [RECONCILIATION], total: 1 }),
		settle: record('settle', TRANSACTION, 2),
		hold: record('hold', TRANSACTION, 3)
	};

	const sellerPayoutService = {
		listPayouts: record('listPayouts', { items: [PAYOUT], total: 1 }),
		getPayout: record('getPayout', PAYOUT),
		createPayout: record('createPayout', PAYOUT),
		approve: record('approve', PAYOUT),
		recordExecution: record('recordExecution', PAYOUT, 2),
		cancel: record('cancel', { payout: PAYOUT, releasedTransactionCount: 1 }, 2)
	};

	const sellerPayoutLineService = { listLines: record('listLines', { items: [PAYOUT_LINE], total: 1 }) };
	const sellerSettlementService = {
		listSettlements: record('listSettlements', { items: [SETTLEMENT], total: 1 }),
		record: record('record', SETTLEMENT)
	};

	return new SellerEntityResolver(
		sellerService as any,
		sellerOfferingService as any,
		sellerTransactionService as any,
		sellerPayoutService as any,
		sellerPayoutLineService as any,
		sellerSettlementService as any,
		new BulkExecutor({ assertCanSee: () => undefined, canSee: () => true } as never)
	);
}

/**
 * The six list reads again, recording the options each was handed.
 *
 * The failure these doubles exist for is the one the connection helper hides: a field that declared
 * `withDeleted` and let its read default it answers the live rows however the caller asked, which looks
 * exactly like a field that honoured the flag from the outside.
 *
 * @param calls Where each read records the service method it reached and the options it was handed.
 * @returns A resolver over the recording doubles.
 */
function listingResolver(calls: Array<{ field: string; options: any }>): any {
	const record = (field: string) => async (options: any) => {
		calls.push({ field, options });

		return { items: [], total: 0 };
	};

	return new SellerEntityResolver(
		{ listSellers: record('listSellers') } as any,
		{ listOfferings: record('listOfferings') } as any,
		{ listTransactions: record('listTransactions') } as any,
		{ listPayouts: record('listPayouts') } as any,
		{ listLines: record('listLines') } as any,
		{ listSettlements: record('listSettlements') } as any,
		new BulkExecutor({ assertCanSee: () => undefined, canSee: () => true } as never)
	);
}

/**
 * How each declared field is called, and the row its own type is read from.
 *
 * A list field now states the page it is read at, because what it answers is the connection the SDL
 * declares rather than a bare array: the argument sits where the resolver's own `page` parameter sits,
 * which is before the context.
 */
const CALLS: Record<string, { args: unknown[]; row: Record<string, unknown> }> = {
	sellers: { args: [{ first: 20 }], row: SELLER },
	seller: { args: ['seller-1'], row: SELLER },
	sellerStatement: { args: ['seller-1', 'USD'], row: STATEMENT },
	sellerBalance: { args: ['seller-1', 'USD'], row: BALANCE },
	sellerOfferings: { args: [{ first: 20 }], row: OFFERING },
	sellerTransactions: { args: [{ first: 20 }], row: TRANSACTION },
	sellerSplitReconciliation: { args: ['order-1', 'seller-1'], row: RECONCILIATION },
	sellerPayouts: { args: [{ first: 20 }], row: PAYOUT },
	sellerPayout: { args: ['payout-1'], row: PAYOUT },
	sellerPayoutLines: { args: ['payout-1', { first: 20 }], row: PAYOUT_LINE },
	sellerSettlements: { args: [{ first: 20 }], row: SETTLEMENT },
	submitSeller: { args: ['seller-1'], row: SELLER },
	activateSeller: { args: ['seller-1'], row: SELLER },
	suspendSeller: { args: ['seller-1', 'under review'], row: SELLER },
	reinstateSeller: { args: ['seller-1'], row: SELLER },
	publishSellerOffering: { args: ['offering-1', ['channel-1']], row: OFFERING },
	pauseSellerOffering: { args: ['offering-1'], row: OFFERING },
	withdrawSellerOffering: { args: ['offering-1'], row: OFFERING },
	bulkSellerOfferings: {
		args: [
			{
				items: [
					{ id: 'offering-1', operation: 'PUBLISH', channelIds: ['channel-1'] },
					{ id: 'offering-2', operation: 'REPRICE', priceAmount: '12.500000', priceCurrency: 'EUR' }
				],
				mode: 'upsert',
				atomic: true
			}
		],
		row: {
			results: [
				{ index: 0, ok: true, id: 'offering-1', resource: 'seller_offering' },
				{ index: 1, ok: true, id: 'offering-2', resource: 'seller_offering' }
			],
			succeeded: 2,
			failed: 0,
			total: 2
		}
	},
	settleSellerTransaction: { args: ['transaction-1', 'captured'], row: TRANSACTION },
	holdSellerTransaction: { args: ['transaction-1', 'DISPUTE'], row: TRANSACTION },
	createSellerPayout: { args: ['seller-1', 'USD', ['transaction-1'], 'operator override'], row: PAYOUT },
	approveSellerPayout: { args: ['payout-1'], row: PAYOUT },
	markSellerPayoutPaid: { args: ['payout-1', 'provider-1', 'transfer-1'], row: PAYOUT },
	cancelSellerPayout: { args: ['payout-1', 'duplicate run'], row: PAYOUT },
	createSellerSettlement: {
		args: ['seller-1', 'provider-1', 'USD', '100.000000', '15.000000', '1.000000'],
		row: SETTLEMENT
	}
};

/**
 * The vocabulary each GraphQL enum is declared from.
 *
 * Every entry but the last two is a contract enum of the platform's own. `SellerOfferingBulkOperation` is
 * the batch's own vocabulary, which the plugin declares because no contract enum states it — the four
 * operations are the resource's rather than the platform's four write kinds. `SellerOfferingBulkMode` is
 * the platform's `BulkMode`, which is a TypeScript union and therefore has no runtime values, so the map
 * states the wire strings it holds.
 */
const CONTRACT_ENUMS: Record<string, Record<string, string>> = {
	SellerStatus,
	SellerVerificationStatus,
	CommissionBasis,
	OfferingStatus,
	OfferingCondition,
	OfferingFulfilmentMode,
	TaxCollectionMode,
	TaxRegistrationScheme,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerSettlementStatus,
	SellerTransactionKind,
	SellerTransactionStatus,
	SellerHoldReason,
	SellerOfferingBulkOperation,
	SellerOfferingBulkMode: { UPSERT: 'upsert', REPLACE: 'replace' }
};

/**
 * The six list fields that answer a connection, and the two types each declares.
 *
 * Every one of them answered a bare array until now — a shape a client can neither page nor count — and
 * the conversion is per field, so a field left behind is a client's problem to notice. The pairing is
 * stated here because the halves of a connection drift apart silently: an `edges` naming an edge type the
 * document does not declare compiles into a schema that serves the page and no way to walk it.
 */
const CONNECTIONS: ReadonlyArray<{ field: string; connection: string; edge: string; row: string }> = [
	{ field: 'sellers', connection: 'SellerConnection', edge: 'SellerEdge', row: 'Seller' },
	{
		field: 'sellerOfferings',
		connection: 'SellerOfferingConnection',
		edge: 'SellerOfferingEdge',
		row: 'SellerOffering'
	},
	{
		field: 'sellerTransactions',
		connection: 'SellerTransactionConnection',
		edge: 'SellerTransactionEdge',
		row: 'SellerTransaction'
	},
	{ field: 'sellerPayouts', connection: 'SellerPayoutConnection', edge: 'SellerPayoutEdge', row: 'SellerPayout' },
	{
		field: 'sellerPayoutLines',
		connection: 'SellerPayoutLineConnection',
		edge: 'SellerPayoutLineEdge',
		row: 'SellerPayoutLine'
	},
	{
		field: 'sellerSettlements',
		connection: 'SellerSettlementConnection',
		edge: 'SellerSettlementEdge',
		row: 'SellerSettlement'
	}
];

/** The members of one `type <name> { … }` declaration of the printed document, or an empty string. */
function declaredBodyOf(printed: string, name: string): string {
	return new RegExp(`type ${name} \\{([^}]*)\\}`).exec(printed)?.[1] ?? '';
}

/** Unwraps a root field's type to the object type a row is read as. */
function rowTypeOf(field: DeclaredField): GraphQLObjectType {
	const root = field.operation === 'Query' ? COMPOSED.getQueryType() : COMPOSED.getMutationType();
	const declared = root?.getFields()[field.field];
	if (!declared) {
		throw new Error(`The schema declares no ${field.operation}.${field.field}.`);
	}

	return getNamedType(declared.type) as GraphQLObjectType;
}

/* ------------------------------------------------------------------------------------------------
 * The retry-safety mirror
 * ---------------------------------------------------------------------------------------------- */

/** The member a GraphQL caller states its retry key in, beside the input it qualifies. */
const IDEMPOTENCY_KEY_MEMBER = 'idempotencyKey';

/**
 * One route that declares a retry scope, and the mutation declared to mirror it.
 *
 * The scope is the operation's identity on both surfaces, so a client that presents one key to REST and
 * one key over GraphQL is making two attempts at one operation, and the two protocols have to answer it
 * identically for that to be true. `required` is the route's own: executing a payout requires a key,
 * because a retry of it pays the seller twice.
 *
 * Only operations the schema mirrors appear here. A route the document declares no mutation for has
 * nothing to mirror, and inventing one is exactly what the parity rule forbids.
 */
const RETRY_MIRRORS: ReadonlyArray<{
	scope: string;
	mutation: string;
	controller: any;
	route: string;
	required: boolean;
	resourceType?: string;
}> = [
	{
		scope: 'seller_offering.publish',
		mutation: 'publishSellerOffering',
		controller: SellerOfferingController,
		route: 'publish',
		required: false,
		resourceType: 'seller_offering'
	},
	{
		scope: 'seller_offering.bulk',
		mutation: 'bulkSellerOfferings',
		controller: SellerOfferingController,
		route: 'bulk',
		required: false,
		resourceType: 'seller_offering'
	},
	{
		scope: 'seller.transaction.settle',
		mutation: 'settleSellerTransaction',
		controller: SellerTransactionController,
		route: 'settle',
		required: false,
		resourceType: 'seller_transaction'
	},
	{
		scope: 'seller.payout.create',
		mutation: 'createSellerPayout',
		controller: SellerPayoutController,
		route: 'create',
		required: false,
		resourceType: 'seller_payout'
	},
	{
		scope: 'seller.payout.pay',
		mutation: 'markSellerPayoutPaid',
		controller: SellerPayoutController,
		route: 'pay',
		required: true,
		resourceType: 'seller_payout'
	},
	{
		scope: 'seller.settlement.record',
		mutation: 'createSellerSettlement',
		controller: SellerSettlementController,
		route: 'create',
		required: false,
		resourceType: 'seller_settlement'
	}
];

/** One retry declaration, as the decorator wrote it onto a method. */
interface RetryDeclaration {
	scope: string;
	required?: boolean;
	resourceType?: string;
}

/**
 * The retry declaration a method carries, or undefined when it carries none.
 *
 * Read from the method's own metadata rather than from the text of either file: the interceptor decides
 * from that metadata, so a declaration the runtime cannot see is not a declaration at all.
 */
function retryOf(owner: any, method: string): RetryDeclaration | undefined {
	return Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, owner.prototype[method]);
}

/** Every mutation whose resolver declares a retry scope. */
function adoptedMutations(): string[] {
	return DECLARED.filter(
		(entry) => entry.operation === 'Mutation' && retryOf(SellerEntityResolver, entry.method)
	).map((entry) => entry.field);
}

/**
 * Every mutation whose declared arguments carry a retry key.
 *
 * A key reaches the kernel through one of two declared places: an argument of the field itself, or the
 * input object the field takes — which is where a mutation whose request is a body of its own carries it,
 * as the batch does. Both are the schema declaring the member, which is what the assertion below is
 * about, so both are read.
 */
function keyedMutations(): string[] {
	const fields = COMPOSED.getMutationType()?.getFields() ?? {};

	return Object.values(fields)
		.filter((field) => Boolean(retryKeyOf(field)))
		.map((field) => field.name);
}

/**
 * The retry key a mutation declares, as the schema states it.
 *
 * @param field The mutation's field definition.
 * @returns The declared member, or undefined when neither place carries one.
 */
function retryKeyOf(field: GraphQLField<unknown, unknown>): GraphQLArgument | GraphQLInputField | undefined {
	const direct = field.args.find((argument) => argument.name === IDEMPOTENCY_KEY_MEMBER);

	if (direct) {
		return direct;
	}

	for (const argument of field.args) {
		const named = getNamedType(argument.type);
		const member = named instanceof GraphQLInputObjectType ? named.getFields()[IDEMPOTENCY_KEY_MEMBER] : undefined;

		if (member) {
			return member;
		}
	}

	return undefined;
}

/* ------------------------------------------------------------------------------------------------
 * The invariants
 * ---------------------------------------------------------------------------------------------- */

describe('the marketplace GraphQL contribution', () => {
	describe('the plugin metadata', () => {
		it('contributes a schema extension that parses as SDL', () => {
			expect(CONTRIBUTED_SCHEMA).toBe(schemaExtensions);
			expect(parse(print(CONTRIBUTED_SCHEMA)).kind).toBe(Kind.DOCUMENT);
		});

		it('registers every resolver the package exports, and nothing else', () => {
			expect(EXPORTED_RESOLVERS.length).toBeGreaterThan(0);
			expect([...CONTRIBUTED_RESOLVERS].sort()).toEqual([...EXPORTED_RESOLVERS].sort());
		});

		it('declares those resolvers as providers of the module the plugin registers', () => {
			const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MarketplaceModule) ?? [];

			for (const resolver of EXPORTED_RESOLVERS) {
				expect(providers).toContain(resolver);
			}
		});
	});

	describe('the composed schema', () => {
		it('extends the platform root types rather than redeclaring them', () => {
			const redeclared = CONTRIBUTED_SCHEMA.definitions
				.filter(
					(definition: any) =>
						definition.kind === Kind.OBJECT_TYPE_DEFINITION &&
						['Query', 'Mutation'].includes(definition.name.value)
				)
				.map((definition: any) => definition.name.value);

			expect(redeclared).toEqual([]);
		});

		it.each(Object.keys(CONTRACT_ENUMS))('declares every value of the %s vocabulary', (name) => {
			const declared = COMPOSED.getType(name) as GraphQLEnumType;

			expect(declared).toBeInstanceOf(GraphQLEnumType);
			expect(declared.getValues().map((value) => value.name).sort()).toEqual(
				Object.values(CONTRACT_ENUMS[name]).sort()
			);
		});

		it.each(DECLARED.map((entry) => [entry.operation, entry.field]))(
			'declares %s.%s',
			(operation, field) => {
				const root = operation === 'Query' ? COMPOSED.getQueryType() : COMPOSED.getMutationType();

				expect(Object.keys(root?.getFields() ?? {})).toContain(field);
			}
		);

		it('declares no root field the resolvers do not answer', () => {
			const answered = new Set(DECLARED.map((entry) => `${entry.operation}.${entry.field}`));
			const unanswered = EXTENDED.map((entry) => `${entry.operation}.${entry.field}`).filter(
				(key) => !answered.has(key)
			);

			expect(unanswered).toEqual([]);
		});

		it('answers each converted list field with a connection of its own row type', () => {
			const printed = print(CONTRIBUTED_SCHEMA);
			const mismatches: string[] = [];

			for (const { field, connection, edge, row } of CONNECTIONS) {
				const declared = COMPOSED.getQueryType()?.getFields()[field];

				if (!declared) {
					mismatches.push(`the schema declares no Query.${field}`);
					continue;
				}

				// The root field itself, not only the types beside it: a connection declared and not answered
				// is a page no client ever receives, and one the caller cannot state a window on is a page it
				// cannot walk.
				if (getNamedType(declared.type).name !== connection) {
					mismatches.push(`Query.${field} does not answer ${connection}`);
				}
				if (!declared.args.some((argument) => argument.name === 'page')) {
					mismatches.push(`Query.${field} states no page argument, so its connection cannot be walked`);
				}

				const connectionBody = declaredBodyOf(printed, connection);
				const edgeBody = declaredBodyOf(printed, edge);

				for (const member of [
					`nodes: [${row}!]!`,
					`edges: [${edge}!]!`,
					'totalCount: Int!',
					'pageInfo: PageInfo!'
				]) {
					if (!connectionBody.includes(member)) {
						mismatches.push(`${connection} declares no \`${member}\``);
					}
				}

				for (const member of [`node: ${row}!`, 'cursor: String!']) {
					if (!edgeBody.includes(member)) {
						mismatches.push(`${edge} declares no \`${member}\``);
					}
				}
			}

			expect(mismatches).toEqual([]);
		});

		it('declares withDeleted on every converted list field, as the REST list route does', () => {
			// The six REST list routes read through `BaseQueryDTO`, so a REST caller can ask for the rows a
			// tenant retired. A connection field that declared no such argument would refuse that question
			// at the schema while the same question is one query parameter away on the other protocol.
			for (const { field } of CONNECTIONS) {
				const declared = COMPOSED.getQueryType()?.getFields()[field];
				const argument = declared?.args.find((candidate) => candidate.name === 'withDeleted');

				expect({ field, type: argument ? getNamedType(argument.type).name : undefined }).toEqual({
					field,
					type: 'Boolean'
				});
				// Nullable: the flag is the caller's to state, so a document that required it would refuse
				// every query that says nothing about retired rows.
				expect({ field, required: argument ? isNonNullType(argument.type) : undefined }).toEqual({
					field,
					required: false
				});
			}
		});
	});

	describe('the soft-delete visibility the REST list routes have', () => {
		it('asks each read for retired rows when the caller states withDeleted, and states nothing when it does not', async () => {
			const calls: Array<{ field: string; options: any }> = [];
			const resolver = listingResolver(calls);

			await resolver.sellers({ first: 20 }, true);
			await resolver.sellerOfferings({ first: 20 }, true);
			await resolver.sellerTransactions({ first: 20 }, true);
			await resolver.sellerPayouts({ first: 20 }, true);
			await resolver.sellerPayoutLines('payout-1', { first: 20 }, true);
			await resolver.sellerSettlements({ first: 20 }, true);
			await resolver.sellers({ first: 20 }, undefined);

			// Every converted field reaches its own read, so a field whose flag stopped at the resolver is
			// reported by name rather than by a count that happens to match.
			expect(calls.map((call) => call.field)).toEqual([
				'listSellers',
				'listOfferings',
				'listTransactions',
				'listPayouts',
				'listLines',
				'listSettlements',
				'listSellers'
			]);

			for (const call of calls.slice(0, 6)) {
				expect({ field: call.field, withDeleted: call.options.withDeleted }).toEqual({
					field: call.field,
					withDeleted: true
				});
			}

			// Absent rather than `false`: the two select the same rows, but the option is not stated, so a
			// read whose default ever changes is not silently pinned to the older behaviour by this field.
			expect('withDeleted' in calls[6].options).toBe(false);
		});
	});

	describe('the rows the resolvers hand back', () => {
		it('carries every field the schema declares, and no field it does not', async () => {
			// A resolver whose declarations could not be read would make every assertion below vacuous,
			// and a double that states how to call a field the resolver no longer declares is a stale one.
			expect(DECLARED.length).toBe(Object.keys(CALLS).length);

			const resolver = createResolver();
			const mismatches: string[] = [];

			for (const declared of DECLARED) {
				const call = CALLS[declared.field];
				if (!call) {
					mismatches.push(`${declared.operation}.${declared.field} has no double that states how to call it`);
					continue;
				}

				const returned = await (resolver as any)[declared.method](...call.args);
				const row = Array.isArray(returned) ? returned[0] : returned;
				const expected = Object.keys(rowTypeOf(declared).getFields()).sort();
				const carried = Object.keys(row ?? {}).sort();

				for (const field of expected) {
					if (!carried.includes(field)) {
						mismatches.push(`${declared.field}: the row carries no "${field}", which the schema declares`);
					}
				}

				for (const field of carried) {
					if (!expected.includes(field)) {
						mismatches.push(`${declared.field}: the row carries "${field}", which the schema does not declare`);
					}
				}
			}

			expect(mismatches).toEqual([]);
		});
	});

	describe('the retry-safety mirror', () => {
		it.each(RETRY_MIRRORS.map((mirror) => mirror.scope))(
			'answers %s with one declaration on both protocols',
			(scope) => {
				const mirror = RETRY_MIRRORS.find((candidate) => candidate.scope === scope)!;
				const answering = DECLARED.find((entry) => entry.field === mirror.mutation);
				const expected = {
					scope: mirror.scope,
					required: mirror.required,
					...(mirror.resourceType ? { resourceType: mirror.resourceType } : {})
				};

				// The mutation the document declares for this scope is answered by a method that carries the
				// declaration — not by some other field that happens to be named similarly.
				expect(answering?.operation).toBe('Mutation');
				expect(retryOf(SellerEntityResolver, answering!.method)).toEqual(expected);
				expect(retryOf(mirror.controller, mirror.route)).toEqual(expected);
			}
		);

		it('declares the retry key on exactly the mutations that have adopted the convention', () => {
			const adopted = adoptedMutations();

			// The equality is the invariant in both directions: a mutation that declares the member without
			// adopting the convention would expose an argument nothing reads, and a mutation that adopts it
			// without declaring the member could never be presented with a key.
			expect(adopted.length).toBeGreaterThan(0);
			expect([...keyedMutations()].sort()).toEqual([...adopted].sort());
		});

		it.each(RETRY_MIRRORS.map((mirror) => mirror.mutation))(
			'declares %s idempotencyKey as a nullable String',
			(mutation) => {
				const declared = COMPOSED.getMutationType()?.getFields()[mutation];
				const argument = declared ? retryKeyOf(declared) : undefined;

				expect(declared).toBeDefined();
				expect(argument).toBeDefined();
				expect(getNamedType(argument!.type).name).toBe('String');
				// Nullable on purpose, including on the mutation whose route requires a key: the refusal is the
				// kernel's own `IDEMPOTENCY_KEY_REQUIRED`, which is the answer the route gives, and a schema-level
				// requirement would replace it with a validation error the REST caller never sees.
				expect(isNonNullType(argument!.type)).toBe(false);
			}
		);

		it('requires the key only on the mutation that mirrors the route moving money', () => {
			const required = RETRY_MIRRORS.filter((mirror) => mirror.required).map((mirror) => mirror.mutation);

			expect(required).toEqual(['markSellerPayoutPaid']);
			expect(retryOf(SellerPayoutController, 'pay')).toMatchObject({ required: true });
		});
	});

	/* --------------------------------------------------------------------------------------------
	 * The seller scope
	 * ------------------------------------------------------------------------------------------ */

	describe('the seller scope', () => {
		it('mounts the seller access guard the controllers mount', () => {
			// Parity of the *guard family*, which is what the class docstring claims and what was missing:
			// the REST controllers carry the access guard and hand the scope it resolves to every service
			// call, and this class carried neither — so a seller-side credential read every seller's rows
			// over GraphQL while the same credential over REST saw only its own.
			const onResolver = Reflect.getMetadata(GUARDS_METADATA, SellerEntityResolver) ?? [];
			const onController = Reflect.getMetadata(GUARDS_METADATA, SellerController) ?? [];

			expect(onResolver).toContain(SellerAccessGuard);
			expect(onController).toContain(SellerAccessGuard);
		});

		it('threads the scope the guard resolved into every field that takes one', async () => {
			const calls: Array<{ field: string; scope?: ISellerScope }> = [];
			const scope: ISellerScope = { sellerId: 'seller-1', staff: false } as ISellerScope;
			const resolver = recordingResolver(calls);
			const context = { req: { sellerScope: scope } };

			await resolver.sellers(undefined, undefined, context);
			await resolver.seller('seller-1', context);
			await resolver.sellerStatement('seller-1', 'USD', context);
			await resolver.sellerBalance('seller-1', 'USD', context);
			await resolver.sellerOfferings(undefined, undefined, context);
			await resolver.sellerTransactions(undefined, undefined, context);
			await resolver.sellerSplitReconciliation('order-1', 'seller-1', context);
			await resolver.sellerPayouts(undefined, undefined, context);
			await resolver.sellerPayout('payout-1', context);
			await resolver.sellerPayoutLines('payout-1', undefined, undefined, context);
			await resolver.sellerSettlements(undefined, undefined, context);
			await resolver.createSellerPayout('seller-1', 'USD', ['transaction-1'], 'note', undefined, context);
			await resolver.approveSellerPayout('payout-1', context);
			await resolver.markSellerPayoutPaid('payout-1', 'provider-1', 'transfer-1', undefined, context);
			await resolver.cancelSellerPayout('payout-1', 'duplicate run', context);
			await resolver.settleSellerTransaction('transaction-1', 'captured', undefined, context);
			await resolver.holdSellerTransaction('transaction-1', 'DISPUTE', context);
			await resolver.createSellerSettlement('seller-1', 'provider-1', 'USD', '100.000000', undefined, undefined, undefined, context);
			await resolver.submitSeller('seller-1', context);
			await resolver.activateSeller('seller-1', context);
			await resolver.suspendSeller('seller-1', 'under review', context);
			await resolver.reinstateSeller('seller-1', context);
			await resolver.publishSellerOffering('offering-1', ['channel-1'], undefined, context);
			await resolver.pauseSellerOffering('offering-1', context);
			await resolver.withdrawSellerOffering('offering-1', context);

			// Not one of them may run unscoped: a field that dropped the scope is a field a seller-scoped
			// credential reaches another seller's rows through, and it would look exactly like the others.
			expect(calls.length).toBeGreaterThan(0);
			expect(calls.filter((call) => call.scope !== scope).map((call) => call.field)).toEqual([]);
		});

		it('reads the scope off the context itself when the server carries no request', async () => {
			// The guard writes it to both places, because a GraphQL server does not have to build a request.
			const calls: Array<{ field: string; scope?: ISellerScope }> = [];
			const scope: ISellerScope = { sellerId: 'seller-1', staff: false } as ISellerScope;

			await recordingResolver(calls).sellerPayouts(undefined, undefined, { sellerScope: scope });

			expect(calls).toEqual([{ field: 'listPayouts', scope }]);
		});

		it('answers a field called with no context at all, as a staff-free surface did before', async () => {
			const calls: Array<{ field: string; scope?: ISellerScope }> = [];

			await recordingResolver(calls).sellerPayouts();

			expect(calls).toEqual([{ field: 'listPayouts', scope: undefined }]);
		});
	});
});
