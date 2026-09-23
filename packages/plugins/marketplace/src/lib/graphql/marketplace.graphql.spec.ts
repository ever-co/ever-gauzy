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
	// The permission decorator is doubled with the platform's own metadata key, read from the platform's
	// constants, so the assertions below are made against the metadata a guard actually reads rather than
	// against the decorator's prose. A no-op double would let a mutation state no permission at all while
	// this suite stayed green — the class-level read grant would be the only thing in front of a write,
	// and nothing here would say so.
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

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
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
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
	PermissionsEnum,
	SellerHoldReason,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerSettlementStatus,
	SellerStatus,
	SellerTransactionKind,
	SellerTransactionStatus,
	SellerVerificationKind,
	SellerVerificationStatus,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { getPluginExtensions } from '@gauzy/plugin';
import { BulkExecutor, IDEMPOTENT_METADATA_KEY } from '@gauzy/core';
import { MarketplaceModule } from '../marketplace.module';
import { MarketplacePlugin } from '../marketplace.plugin';
import { SellerOfferingController } from '../seller-offering/seller-offering.controller';
import { SellerOfferingBulkOperation } from '../seller-offering/seller-offering.bulk';
import { SellerPayoutController } from '../seller-payout/seller-payout.controller';
import { SellerPayoutLineController } from '../seller-payout-line/seller-payout-line.controller';
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
		createSeller: async () => SELLER,
		updateSeller: async () => SELLER,
		submit: async () => SELLER,
		verify: async () => SELLER,
		activate: async () => SELLER,
		suspend: async () => SELLER,
		reinstate: async () => SELLER,
		reject: async () => SELLER,
		startOffboarding: async () => SELLER,
		delete: async () => DELETE_RESULT,
		softRemove: async () => SELLER,
		softRecover: async () => SELLER
	};

	const sellerOfferingService = {
		listOfferings: async () => ({ items: [OFFERING], total: 1 }),
		createOffering: async () => OFFERING,
		updateOffering: async () => OFFERING,
		publish: async () => OFFERING,
		unpause: async () => OFFERING,
		withdraw: async () => OFFERING,
		applyBulkItem: async (item: { id: string }) => ({ ...OFFERING, id: item.id }),
		transaction: async (work: (manager: unknown) => Promise<unknown>) => await work(undefined),
		softRemove: async () => OFFERING,
		softRecover: async () => OFFERING
	};

	const sellerTransactionService = {
		listTransactions: async () => ({ items: [TRANSACTION], total: 1 }),
		reconcile: async () => ({ items: [RECONCILIATION], total: 1 }),
		settle: async () => TRANSACTION,
		hold: async () => TRANSACTION,
		delete: async () => DELETE_RESULT,
		softRemove: async () => TRANSACTION,
		softRecover: async () => TRANSACTION
	};

	const sellerPayoutService = {
		listPayouts: async () => ({ items: [PAYOUT], total: 1 }),
		getPayout: async () => PAYOUT,
		createPayout: async () => PAYOUT,
		update: async () => PAYOUT,
		findOneByIdString: async () => PAYOUT,
		run: async () => [PAYOUT_RUN_RESULT],
		approve: async () => PAYOUT,
		recordExecution: async () => PAYOUT,
		cancel: async () => ({ payout: PAYOUT, releasedTransactionCount: 1 }),
		retry: async () => PAYOUT,
		delete: async () => DELETE_RESULT,
		softRemove: async () => PAYOUT,
		softRecover: async () => PAYOUT
	};

	const sellerPayoutLineService = {
		listLines: async () => ({ items: [PAYOUT_LINE], total: 1 }),
		delete: async () => DELETE_RESULT,
		softRemove: async () => PAYOUT_LINE,
		softRecover: async () => PAYOUT_LINE
	};

	const sellerSettlementService = {
		listSettlements: async () => ({ items: [SETTLEMENT], total: 1 }),
		record: async () => SETTLEMENT,
		update: async () => SETTLEMENT,
		findOneByIdString: async () => SETTLEMENT,
		reconcile: async () => SETTLEMENT_RECONCILIATION,
		close: async () => SETTLEMENT,
		dispute: async () => SETTLEMENT,
		delete: async () => DELETE_RESULT,
		softRemove: async () => SETTLEMENT,
		softRecover: async () => SETTLEMENT
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
		updateSeller: record('updateSeller', SELLER, 2),
		submit: record('submit', SELLER),
		activate: record('activate', SELLER),
		suspend: record('suspend', SELLER, 2),
		reinstate: record('reinstate', SELLER)
	};

	const sellerOfferingService = {
		listOfferings: record('listOfferings', { items: [OFFERING], total: 1 }),
		createOffering: record('createOffering', OFFERING),
		updateOffering: record('updateOffering', OFFERING, 2),
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
		cancel: record('cancel', { payout: PAYOUT, releasedTransactionCount: 1 }, 2),
		retry: record('retry', PAYOUT)
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
 * What a hard deletion answers, in the shape its own type declares.
 *
 * One member and not the ORM's whole result: `raw` is the driver's payload rather than the platform's
 * answer, so a type that carried it would teach a client to read a Postgres-specific envelope.
 */
const DELETE_RESULT: Record<string, unknown> = { affected: 1 };

/**
 * What one payout run decided for one seller, in the shape the document declares it.
 *
 * A run answers a decision rather than a row, so the fixture carries both halves of that decision: the
 * payout the run created and, when it created none, the reason it did not. A row that carried only the
 * amounts would let a field that dropped the run's verdict pass this file's schema comparison.
 */
const PAYOUT_RUN_RESULT: Record<string, unknown> = {
	sellerId: 'seller-1',
	currency: 'USD',
	balance: '18.591500',
	reserveAmount: '0.929575',
	payable: '17.661925',
	payoutId: 'payout-1',
	skippedReason: undefined
};

/** One platform line of the period a reconciliation compared, as the comparison answers it. */
const SETTLEMENT_DIFFERENCE: Record<string, unknown> = {
	transactionId: 'transaction-1',
	platformNet: '18.591500'
};

/**
 * What a reconciliation found: the settlement it moved and the lines it compared.
 *
 * The settlement is the same fixture the resource's own reads answer with, because the two are one row:
 * a reconciliation fixture of its own would let a field wired to a neighbouring service pass the row
 * comparison below while the route reached something else.
 */
const SETTLEMENT_RECONCILIATION: Record<string, unknown> = {
	settlement: SETTLEMENT,
	differences: [SETTLEMENT_DIFFERENCE]
};

/* ------------------------------------------------------------------------------------------------
 * The seller writes
 * ---------------------------------------------------------------------------------------------- */

/** The body a caller supplies to open a seller account, with the two members its route requires. */
const CREATE_SELLER: Record<string, unknown> = {
	code: 'SELL-2',
	contactId: 'contact-2',
	name: 'Seller Two',
	payoutCurrency: 'USD',
	payoutSchedule: 'MONTHLY',
	commissionTiers: [{ from: '0.000000', to: '100.000000', rate: '0.120000' }]
};

/** The body a caller supplies to amend one. No code and no party binding: both are immutable. */
const UPDATE_SELLER: Record<string, unknown> = {
	name: 'Seller One Renamed',
	defaultCommissionRate: '0.180000',
	payoutThreshold: '75.000000'
};

/** One verification verdict, in the shape the recording route accepts. */
const VERIFY_SELLER: Record<string, unknown> = {
	kind: SellerVerificationKind.TAX_IDENTIFIER,
	status: SellerVerificationStatus.VERIFIED,
	reference: 'reference-1',
	provider: 'provider-1',
	expiresAt: new Date('2027-01-01T00:00:00.000Z')
};

/** The body a caller supplies to offer a variant, with the two members its route requires. */
const CREATE_OFFERING: Record<string, unknown> = {
	sellerId: 'seller-1',
	variantId: 'variant-1',
	title: 'An offering',
	priceAmount: '19.990000',
	priceCurrency: 'USD'
};

/** The body a caller supplies to amend one. No seller and no variant: both are immutable. */
const UPDATE_OFFERING: Record<string, unknown> = {
	title: 'An offering, renamed',
	priceAmount: '21.500000',
	isFeatured: true
};

/** The body a caller supplies to amend a payout. No amount: the payout's lines are its amount. */
const UPDATE_PAYOUT: Record<string, unknown> = {
	note: 'operator override',
	providerReference: 'reference-1'
};

/**
 * The body a caller supplies to run a payout pass.
 *
 * The two period members are `Date`s, because that is the shape the field hands the service: the route
 * converts an RFC 3339 string at its own boundary, and the document declares the instant rather than the
 * text so a GraphQL caller states the same thing.
 */
const RUN_PAYOUT: Record<string, unknown> = {
	periodStart: new Date('2026-02-01T00:00:00.000Z'),
	periodEnd: new Date('2026-03-01T00:00:00.000Z'),
	sellerIds: ['seller-1'],
	currency: 'USD',
	dryRun: true
};

/** The body a caller supplies to amend a settlement. */
const UPDATE_SETTLEMENT: Record<string, unknown> = {
	status: SellerSettlementStatus.OPEN,
	note: 'awaiting the provider report'
};

/** The body a caller supplies to reconcile one. */
const RECONCILE_SETTLEMENT: Record<string, unknown> = {
	providerReportId: 'report-1',
	note: 'compared against the ledger'
};

/**
 * One seller write field, the route it mirrors, and the call that route makes.
 *
 * The four are stated together because the failure this table exists for is a mutation that answers the
 * right shape while reaching the wrong method: `offboardSeller` is the field whose route calls a method
 * not named after it, `restoreSeller` is the field whose route reaches `softRecover`, and `deleteSeller`
 * is the only one of the twelve that answers a result rather than a seller. A field wired to the
 * neighbouring method would return a seller either way, and nothing else in this file would notice.
 *
 * `permission` is carried rather than read from the resolver alone for the reason the assertion below
 * gives: the point is that the two surfaces state ONE string, so the controller's own metadata is read
 * back and compared, rather than a copy of the string being trusted here.
 */
const SELLER_WRITES: ReadonlyArray<{
	field: string;
	method: string;
	route: string;
	permission: PermissionsEnum;
	service: string;
	call: (scope: ISellerScope) => unknown[];
}> = [
	{
		field: 'createSeller',
		method: 'createSeller',
		route: 'create',
		permission: PermissionsEnum.SELLERS_CREATE,
		service: 'createSeller',
		// The route hands over no scope, and neither does this. `createSeller` accepts one and never reads
		// it, so a field that invented one would be the only difference between the two protocols — and a
		// difference that refuses a caller the other surface served is as much a divergence as one that
		// serves a caller the other refused.
		call: () => [CREATE_SELLER]
	},
	{
		field: 'updateSeller',
		method: 'updateSeller',
		route: 'update',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'updateSeller',
		// The one seller write whose service method narrows by the scope it is handed, so the scope is
		// threaded rather than dropped: an unscoped update is an update of any seller in the organization.
		call: (scope) => ['seller-1', UPDATE_SELLER, scope]
	},
	{
		field: 'submitSeller',
		method: 'submitSeller',
		route: 'submit',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'submit',
		call: (scope) => ['seller-1', scope]
	},
	{
		field: 'verifySeller',
		method: 'verifySeller',
		route: 'verify',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'verify',
		call: () => ['seller-1', VERIFY_SELLER]
	},
	{
		field: 'activateSeller',
		method: 'activateSeller',
		route: 'activate',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'activate',
		call: (scope) => ['seller-1', scope]
	},
	{
		field: 'suspendSeller',
		method: 'suspendSeller',
		route: 'suspend',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'suspend',
		call: (scope) => ['seller-1', 'under review', scope]
	},
	{
		field: 'reinstateSeller',
		method: 'reinstateSeller',
		route: 'reinstate',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'reinstate',
		call: (scope) => ['seller-1', scope]
	},
	{
		field: 'rejectSeller',
		method: 'rejectSeller',
		route: 'reject',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'reject',
		// `reject` takes no scope on the service, because a refusal is not narrowed by membership: the
		// route reaches it with the reason alone and the field does the same.
		call: () => ['seller-1', 'incomplete documents']
	},
	{
		field: 'offboardSeller',
		method: 'offboardSeller',
		route: 'offboard',
		permission: PermissionsEnum.SELLERS_EDIT,
		service: 'startOffboarding',
		// The route is named `offboard` and the method it reaches is `startOffboarding`: the move is the
		// first step of a durable operation rather than the whole of it, and the name says which.
		call: () => ['seller-1']
	},
	{
		field: 'deleteSeller',
		method: 'deleteSeller',
		route: 'delete',
		permission: PermissionsEnum.SELLERS_DELETE,
		service: 'delete',
		call: () => ['seller-1']
	},
	{
		field: 'softDeleteSeller',
		method: 'softDeleteSeller',
		route: 'softRemove',
		permission: PermissionsEnum.SELLERS_DELETE,
		service: 'softRemove',
		// The inherited route hands `softRemove` its rest parameter — an empty array — which the service
		// normalises to no find options. The call stated here is the one that normalisation reaches.
		call: () => ['seller-1']
	},
	{
		field: 'restoreSeller',
		method: 'restoreSeller',
		route: 'softRecover',
		permission: PermissionsEnum.SELLERS_DELETE,
		service: 'softRecover',
		call: () => ['seller-1']
	}
];

/**
 * The remaining write routes of the marketplace's five child resources, and the calls their fields make.
 *
 * The seller table states one call per field because each of those fields makes one. This table states a
 * *sequence*, because two of these fields make two calls: the route's own `update` answers the ORM's write
 * envelope rather than the row — while `06-api-specification.md` gives a `PUT` the updated resource, "not a
 * bare `UpdateResult`" — so those two fields reach the same base read the write performs as its own
 * precondition and answer the row a client asked to amend. Stating the sequence is what keeps that visible:
 * a field that read with a *scoped* method instead, or that read without writing, is reported by these
 * entries rather than passing on the shape of its answer.
 *
 * The controller is carried per row for the reason the seller table's rows give: the controller is the
 * real one, so the grant a field must state is read back from the route it mirrors rather than copied into
 * this file, and each of these five resources has its own controller.
 */
const RESOURCE_WRITES: ReadonlyArray<{
	field: string;
	method: string;
	route: string;
	controller: any;
	permission: PermissionsEnum;
	args: (scope: ISellerScope, context: unknown) => unknown[];
	calls: (scope: ISellerScope) => Array<{ service: string; args: unknown[] }>;
}> = [
	{
		field: 'createSellerOffering',
		method: 'createSellerOffering',
		route: 'create',
		controller: SellerOfferingController,
		permission: PermissionsEnum.SELLER_OFFERINGS_EDIT,
		// The key is stated as absent and the context is stated after it, because that is the order the
		// field's own parameters are in: a caller that sent a keyless request over GraphQL is a caller the
		// route serves, so the scope has to reach the service through the parameter that follows it.
		args: (_scope, context) => [CREATE_OFFERING, undefined, context],
		calls: (scope) => [{ service: 'createOffering', args: [CREATE_OFFERING, scope] }]
	},
	{
		field: 'updateSellerOffering',
		method: 'updateSellerOffering',
		route: 'update',
		controller: SellerOfferingController,
		permission: PermissionsEnum.SELLER_OFFERINGS_EDIT,
		args: (_scope, context) => ['offering-1', UPDATE_OFFERING, context],
		calls: (scope) => [{ service: 'updateOffering', args: ['offering-1', UPDATE_OFFERING, scope] }]
	},
	{
		field: 'updateSellerPayout',
		method: 'updateSellerPayout',
		route: 'update',
		controller: SellerPayoutController,
		permission: PermissionsEnum.SELLER_PAYOUTS_CREATE,
		args: () => ['payout-1', UPDATE_PAYOUT],
		// No scope on either call, because the route threads none: `SellerPayoutService.update` takes no
		// scope, and the read-back is the same base read that write performs as its precondition. A field
		// that narrowed here would refuse a caller the other protocol served.
		calls: () => [
			{ service: 'update', args: ['payout-1', UPDATE_PAYOUT] },
			{ service: 'findOneByIdString', args: ['payout-1'] }
		]
	},
	{
		field: 'runSellerPayout',
		method: 'runSellerPayout',
		route: 'run',
		controller: SellerPayoutController,
		permission: PermissionsEnum.SELLER_PAYOUTS_CREATE,
		args: () => [RUN_PAYOUT],
		// The arguments are the route's own coercions rather than the members as they arrived: the two
		// period members are handed on as `Date`s and `dryRun` as a boolean, so a pass asked to be reported
		// is reported on both surfaces rather than paid on one of them.
		calls: () => [
			{
				service: 'run',
				args: [
					{
						periodStart: new Date('2026-02-01T00:00:00.000Z'),
						periodEnd: new Date('2026-03-01T00:00:00.000Z'),
						sellerIds: ['seller-1'],
						currency: 'USD',
						dryRun: true
					}
				]
			}
		]
	},
	{
		field: 'retrySellerPayout',
		method: 'retrySellerPayout',
		route: 'retry',
		controller: SellerPayoutController,
		permission: PermissionsEnum.SELLER_PAYOUTS_APPROVE,
		args: (_scope, context) => ['payout-1', undefined, context],
		calls: (scope) => [{ service: 'retry', args: ['payout-1', scope] }]
	},
	{
		field: 'deleteSellerPayout',
		method: 'deleteSellerPayout',
		route: 'delete',
		controller: SellerPayoutController,
		permission: PermissionsEnum.SELLERS_DELETE,
		args: () => ['payout-1'],
		// The inherited route reaches the deletion with the identifier alone, and the field does the same:
		// the row is gone, so there is nothing left to read back.
		calls: () => [{ service: 'delete', args: ['payout-1'] }]
	},
	{
		field: 'deleteSellerPayoutLine',
		method: 'deleteSellerPayoutLine',
		route: 'delete',
		controller: SellerPayoutLineController,
		permission: PermissionsEnum.SELLERS_DELETE,
		args: () => ['payout-line-1'],
		calls: () => [{ service: 'delete', args: ['payout-line-1'] }]
	},
	{
		field: 'updateSellerSettlement',
		method: 'updateSellerSettlement',
		route: 'update',
		controller: SellerSettlementController,
		permission: PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		args: () => ['settlement-1', UPDATE_SETTLEMENT],
		calls: () => [
			{ service: 'update', args: ['settlement-1', UPDATE_SETTLEMENT] },
			{ service: 'findOneByIdString', args: ['settlement-1'] }
		]
	},
	{
		field: 'reconcileSellerSettlement',
		method: 'reconcileSellerSettlement',
		route: 'reconcile',
		controller: SellerSettlementController,
		permission: PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		args: () => ['settlement-1', RECONCILE_SETTLEMENT],
		// The route passes its body straight on, and so does the field: the comparison and the note it
		// records are the service's, and neither surface invents a member the other does not send.
		calls: () => [{ service: 'reconcile', args: ['settlement-1', RECONCILE_SETTLEMENT] }]
	},
	{
		field: 'closeSellerSettlement',
		method: 'closeSellerSettlement',
		route: 'close',
		controller: SellerSettlementController,
		permission: PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		args: () => ['settlement-1', 'period closed'],
		calls: () => [{ service: 'close', args: ['settlement-1', 'period closed'] }]
	},
	{
		field: 'disputeSellerSettlement',
		method: 'disputeSellerSettlement',
		route: 'dispute',
		controller: SellerSettlementController,
		permission: PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
		args: () => ['settlement-1', 'the provider fee differs'],
		calls: () => [{ service: 'dispute', args: ['settlement-1', 'the provider fee differs'] }]
	},
	{
		field: 'deleteSellerSettlement',
		method: 'deleteSellerSettlement',
		route: 'delete',
		controller: SellerSettlementController,
		permission: PermissionsEnum.SELLERS_DELETE,
		args: () => ['settlement-1'],
		calls: () => [{ service: 'delete', args: ['settlement-1'] }]
	},
	{
		field: 'deleteSellerTransaction',
		method: 'deleteSellerTransaction',
		route: 'delete',
		controller: SellerTransactionController,
		permission: PermissionsEnum.SELLERS_DELETE,
		args: () => ['transaction-1'],
		calls: () => [{ service: 'delete', args: ['transaction-1'] }]
	}
];

/**
 * The five child resources of this plugin that serve the inherited lifecycle pair, and the type each
 * answers with.
 *
 * Every one of them extends `CrudController<T>` and overrides both routes purely to state a permission, so
 * each serves a gated withdraw/restore pair over REST — seven of the ten are the only pair their resource
 * has, because a ledger row, a payout, a payout line and a settlement are never hard-deleted. The
 * controller is the real one, so the grant the field must state is *read back* from the override the route
 * belongs to rather than copied into this file: a copy would agree with whichever of the two surfaces was
 * edited last, which is what the comparison below exists to catch.
 *
 * The type is the resource's own row rather than a result object invented for the pair, because that is
 * what both REST routes answer: the base class hands back whatever the service returned.
 */
interface ILifecycleResource {
	/** The resource as the domain names it, which is what the two root field names are built from. */
	resource: string;
	/** The controller whose `softRemove`/`softRecover` overrides are the source of truth for the grants. */
	controller: any;
	/** The type both fields answer with, as the document declares it. */
	answers: string;
}

const LIFECYCLE_RESOURCES: ReadonlyArray<ILifecycleResource> = [
	{
		resource: 'SellerOffering',
		controller: SellerOfferingController,
		answers: 'SellerOffering'
	},
	{
		resource: 'SellerPayout',
		controller: SellerPayoutController,
		answers: 'SellerPayout'
	},
	{
		resource: 'SellerPayoutLine',
		controller: SellerPayoutLineController,
		answers: 'SellerPayoutLine'
	},
	{
		resource: 'SellerSettlement',
		controller: SellerSettlementController,
		answers: 'SellerSettlement'
	},
	{
		resource: 'SellerTransaction',
		controller: SellerTransactionController,
		answers: 'SellerTransaction'
	}
];

/** One root field of the pair, the route it mirrors and the service method both must reach. */
interface ILifecycleField extends ILifecycleResource {
	/** The root field's name, which is also the resolver method that answers it. */
	field: string;
	/** The resolver method, stated apart from `service` because the two are different vocabularies. */
	method: string;
	/** The controller handler the route belongs to, whose metadata is the source of truth for the grant. */
	route: string;
	/** The service method both the route and the field must reach, named after the act rather than the row. */
	service: string;
}

/**
 * The ten fields, built from the five resources so a resource cannot be listed with only half a pair.
 *
 * The naming is the composed schema's: `softDelete<Resource>` on the way out and `recover<Resource>` on the
 * way back, which is the vocabulary the schema's other fields of this kind use. `restoreSeller` is the one
 * exception in the whole schema, and it is not a precedent: this table's five resources are new fields, so
 * they take the convention rather than the specification's table spelling.
 *
 * The field's name and the service method are stated separately on purpose: the inherited route, the
 * service method and the handler are all named after the act, while the root field is named after the
 * resource, so a table that carried one string for both would compare the wrong pair of things.
 */
const LIFECYCLE: ReadonlyArray<ILifecycleField> = LIFECYCLE_RESOURCES.flatMap((resource) => [
	{
		...resource,
		field: `softDelete${resource.resource}`,
		method: `softDelete${resource.resource}`,
		route: 'softRemove',
		service: 'softRemove'
	},
	{
		...resource,
		field: `recover${resource.resource}`,
		method: `recover${resource.resource}`,
		route: 'softRecover',
		service: 'softRecover'
	}
]);

/**
 * The row each answer type's own service hands back.
 *
 * The journal below proves which *method* a field reached; this proves which *service* it reached, because
 * the five services state the same two method names and a field wired to a neighbouring resource's service
 * would otherwise journal an identical entry. Each service answers its own aggregate's row, so the answer
 * is the witness.
 */
const LIFECYCLE_ROWS: Record<string, Record<string, unknown>> = {
	SellerOffering: OFFERING,
	SellerPayout: PAYOUT,
	SellerPayoutLine: PAYOUT_LINE,
	SellerSettlement: SETTLEMENT,
	SellerTransaction: TRANSACTION
};

/**
 * The seller writes, recording the service method and the arguments each reached.
 *
 * The failure these doubles exist for is a mutation wired to the wrong method, or to the right method
 * with the wrong arguments: either would answer a row of the right shape and look correct from the
 * outside while the route it mirrors did something else.
 *
 * The five services that own the other resources carry their two inherited lifecycle methods into the same
 * journal, because the lifecycle pair below reaches one of them per field: a field wired to a neighbouring
 * resource's service is then reported as a call naming the wrong method rather than passing unnoticed.
 *
 * @param calls Where each call records the service method it reached and the arguments it carried.
 * @returns A resolver over the recording doubles.
 */
function writeResolver(calls: Array<{ service: string; args: unknown[] }>): any {
	const record =
		(service: string, answer: unknown) =>
		(...args: unknown[]) => {
			calls.push({ service, args });

			return Promise.resolve(answer);
		};

	/** The two inherited lifecycle methods of one service, in the same journal as its siblings' writes. */
	const lifecycle = (row: unknown): any => ({
		softRemove: record('softRemove', row),
		softRecover: record('softRecover', row)
	});

	return new SellerEntityResolver(
		{
			createSeller: record('createSeller', SELLER),
			updateSeller: record('updateSeller', SELLER),
			submit: record('submit', SELLER),
			verify: record('verify', SELLER),
			activate: record('activate', SELLER),
			suspend: record('suspend', SELLER),
			reinstate: record('reinstate', SELLER),
			reject: record('reject', SELLER),
			startOffboarding: record('startOffboarding', SELLER),
			delete: record('delete', DELETE_RESULT),
			softRemove: record('softRemove', SELLER),
			softRecover: record('softRecover', SELLER)
		} as any,
		{ ...lifecycle(OFFERING), createOffering: record('createOffering', OFFERING), updateOffering: record('updateOffering', OFFERING) },
		{ ...lifecycle(TRANSACTION), delete: record('delete', DELETE_RESULT) },
		{
			...lifecycle(PAYOUT),
			update: record('update', PAYOUT),
			findOneByIdString: record('findOneByIdString', PAYOUT),
			run: record('run', [PAYOUT_RUN_RESULT]),
			retry: record('retry', PAYOUT),
			delete: record('delete', DELETE_RESULT)
		},
		{ ...lifecycle(PAYOUT_LINE), delete: record('delete', DELETE_RESULT) },
		{
			...lifecycle(SETTLEMENT),
			update: record('update', SETTLEMENT),
			findOneByIdString: record('findOneByIdString', SETTLEMENT),
			reconcile: record('reconcile', SETTLEMENT_RECONCILIATION),
			close: record('close', SETTLEMENT),
			dispute: record('dispute', SETTLEMENT),
			delete: record('delete', DELETE_RESULT)
		},
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
	createSeller: { args: [CREATE_SELLER], row: SELLER },
	updateSeller: { args: ['seller-1', UPDATE_SELLER], row: SELLER },
	submitSeller: { args: ['seller-1'], row: SELLER },
	verifySeller: { args: ['seller-1', VERIFY_SELLER], row: SELLER },
	activateSeller: { args: ['seller-1'], row: SELLER },
	suspendSeller: { args: ['seller-1', 'under review'], row: SELLER },
	reinstateSeller: { args: ['seller-1'], row: SELLER },
	rejectSeller: { args: ['seller-1', 'incomplete documents'], row: SELLER },
	offboardSeller: { args: ['seller-1'], row: SELLER },
	deleteSeller: { args: ['seller-1'], row: DELETE_RESULT },
	softDeleteSeller: { args: ['seller-1'], row: SELLER },
	restoreSeller: { args: ['seller-1'], row: SELLER },
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
	softDeleteSellerOffering: { args: ['offering-1'], row: OFFERING },
	recoverSellerOffering: { args: ['offering-1'], row: OFFERING },
	settleSellerTransaction: { args: ['transaction-1', 'captured'], row: TRANSACTION },
	holdSellerTransaction: { args: ['transaction-1', 'DISPUTE'], row: TRANSACTION },
	softDeleteSellerTransaction: { args: ['transaction-1'], row: TRANSACTION },
	recoverSellerTransaction: { args: ['transaction-1'], row: TRANSACTION },
	createSellerPayout: { args: ['seller-1', 'USD', ['transaction-1'], 'operator override'], row: PAYOUT },
	approveSellerPayout: { args: ['payout-1'], row: PAYOUT },
	markSellerPayoutPaid: { args: ['payout-1', 'provider-1', 'transfer-1'], row: PAYOUT },
	cancelSellerPayout: { args: ['payout-1', 'duplicate run'], row: PAYOUT },
	softDeleteSellerPayout: { args: ['payout-1'], row: PAYOUT },
	recoverSellerPayout: { args: ['payout-1'], row: PAYOUT },
	softDeleteSellerPayoutLine: { args: ['payout-line-1'], row: PAYOUT_LINE },
	recoverSellerPayoutLine: { args: ['payout-line-1'], row: PAYOUT_LINE },
	createSellerSettlement: {
		args: ['seller-1', 'provider-1', 'USD', '100.000000', '15.000000', '1.000000'],
		row: SETTLEMENT
	},
	softDeleteSellerSettlement: { args: ['settlement-1'], row: SETTLEMENT },
	recoverSellerSettlement: { args: ['settlement-1'], row: SETTLEMENT },
	createSellerOffering: { args: [CREATE_OFFERING], row: OFFERING },
	updateSellerOffering: { args: ['offering-1', UPDATE_OFFERING], row: OFFERING },
	updateSellerPayout: { args: ['payout-1', UPDATE_PAYOUT], row: PAYOUT },
	runSellerPayout: { args: [RUN_PAYOUT], row: PAYOUT_RUN_RESULT },
	retrySellerPayout: { args: ['payout-1'], row: PAYOUT },
	deleteSellerPayout: { args: ['payout-1'], row: DELETE_RESULT },
	deleteSellerPayoutLine: { args: ['payout-line-1'], row: DELETE_RESULT },
	updateSellerSettlement: { args: ['settlement-1', UPDATE_SETTLEMENT], row: SETTLEMENT },
	reconcileSellerSettlement: { args: ['settlement-1', RECONCILE_SETTLEMENT], row: SETTLEMENT_RECONCILIATION },
	closeSellerSettlement: { args: ['settlement-1', 'period closed'], row: SETTLEMENT },
	disputeSellerSettlement: { args: ['settlement-1', 'the provider fee differs'], row: SETTLEMENT },
	deleteSellerSettlement: { args: ['settlement-1'], row: DELETE_RESULT },
	deleteSellerTransaction: { args: ['transaction-1'], row: DELETE_RESULT }
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
	SellerVerificationKind,
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
		scope: 'seller.create',
		mutation: 'createSeller',
		controller: SellerController,
		route: 'create',
		required: false,
		resourceType: 'seller'
	},
	{
		scope: 'seller.verify',
		mutation: 'verifySeller',
		controller: SellerController,
		route: 'verify',
		required: false,
		resourceType: 'seller'
	},
	{
		scope: 'seller.offboard',
		mutation: 'offboardSeller',
		controller: SellerController,
		route: 'offboard',
		required: false,
		resourceType: 'seller'
	},
	{
		scope: 'seller_offering.publish',
		mutation: 'publishSellerOffering',
		controller: SellerOfferingController,
		route: 'publish',
		required: false,
		resourceType: 'seller_offering'
	},
	{
		scope: 'seller_offering.create',
		mutation: 'createSellerOffering',
		controller: SellerOfferingController,
		route: 'create',
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
		scope: 'seller.payout.run',
		mutation: 'runSellerPayout',
		controller: SellerPayoutController,
		route: 'run',
		required: false,
		resourceType: 'seller_payout'
	},
	{
		scope: 'seller.payout.retry',
		mutation: 'retrySellerPayout',
		controller: SellerPayoutController,
		route: 'retry',
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
	},
	{
		scope: 'seller.settlement.reconcile',
		mutation: 'reconcileSellerSettlement',
		controller: SellerSettlementController,
		route: 'reconcile',
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

	/* --------------------------------------------------------------------------------------------
	 * The seller writes
	 * ------------------------------------------------------------------------------------------ */

	describe('the seller writes, against the routes they mirror', () => {
		it.each(SELLER_WRITES.map((write) => write.field))(
			'answers %s with its route’s own permission and service call',
			async (field) => {
				const write = SELLER_WRITES.find((candidate) => candidate.field === field)!;
				const declared = DECLARED.find((entry) => entry.field === field);

				// The field is declared, and it is a mutation. A name that drifted onto the query root
				// would be answered here as a read while the route behind it still wrote.
				expect(declared).toBeDefined();
				expect(declared?.operation).toBe('Mutation');

				// Both surfaces state one string, and the controller's is read back rather than copied into
				// the table above: a copy would agree with whichever of the two files was edited last, which
				// is exactly the drift this assertion exists to catch.
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, SellerEntityResolver.prototype[write.method])).toEqual(
					[write.permission]
				);
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, SellerController.prototype[write.route])).toEqual([
					write.permission
				]);

				const calls: Array<{ service: string; args: unknown[] }> = [];
				const scope: ISellerScope = { sellerId: 'seller-1', staff: false } as ISellerScope;

				await writeResolver(calls)[write.method](...CALLS[field].args, { req: { sellerScope: scope } });

				// Exactly one call, to the method the route reaches, with the arguments it reaches it with.
				// A field that also read the seller back, or that handed the scope on where the route did
				// not, is reported by the arguments rather than by a count that happens to match.
				expect(calls).toEqual([{ service: write.service, args: write.call(scope) }]);
			}
		);
	});

	/* --------------------------------------------------------------------------------------------
	 * The remaining writes of the five child resources
	 * ------------------------------------------------------------------------------------------ */

	describe('the resource writes, against the routes they mirror', () => {
		it.each(RESOURCE_WRITES.map((write) => write.field))(
			'answers %s with its route’s own permission and the calls its route makes',
			async (field) => {
				const write = RESOURCE_WRITES.find((candidate) => candidate.field === field)!;
				const declared = DECLARED.find((entry) => entry.field === field);

				// The field is declared, and it is a mutation. A name that drifted onto the query root would
				// be answered here as a read while the route behind it still wrote.
				expect(declared).toBeDefined();
				expect(declared?.operation).toBe('Mutation');

				// Both surfaces state one string, and the controller's is read back rather than copied into
				// the table above: a copy would agree with whichever of the two files was edited last, which
				// is exactly the drift this assertion exists to catch.
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, SellerEntityResolver.prototype[write.method])).toEqual(
					[write.permission]
				);
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, write.controller.prototype[write.route])).toEqual([
					write.permission
				]);

				const calls: Array<{ service: string; args: unknown[] }> = [];
				const scope: ISellerScope = { sellerId: 'seller-1', staff: false } as ISellerScope;
				const context = { req: { sellerScope: scope } };

				await writeResolver(calls)[write.method](...write.args(scope, context));

				// The calls the route makes, in the order it makes them: the write first, with the arguments
				// the route reaches it with, and — on the two fields whose route answers a write envelope —
				// the read that turns that envelope into the row the document declares.
				expect(calls).toEqual(write.calls(scope));
			}
		);
	});

	/* --------------------------------------------------------------------------------------------
	 * The inherited lifecycle pair of the five child resources
	 * ------------------------------------------------------------------------------------------ */

	describe('the child resources’ lifecycle pair, against the routes they mirror', () => {
		it.each(LIFECYCLE.map((entry) => entry.field))(
			'declares %s on the mutation root with the identifier its route takes',
			(field) => {
				const entry = LIFECYCLE.find((candidate) => candidate.field === field)!;
				const declared = DECLARED.find((candidate) => candidate.field === field);
				const answered = COMPOSED.getMutationType()?.getFields()[field];

				// Both halves of the surface, because they fail silently apart: a field the resolver declares
				// and the document does not is never served, and one the document carries with no resolver is
				// answered as if it existed.
				expect(declared).toBeDefined();
				expect(declared?.operation).toBe('Mutation');
				expect(answered).toBeDefined();

				const args = answered?.args ?? [];

				expect(args.map((argument) => argument.name)).toEqual(['id']);
				expect(getNamedType(args[0].type).name).toBe('ID');
				expect(isNonNullType(args[0].type)).toBe(true);

				// The row the resource's own reads and sibling mutations answer with, non-null: the pair
				// answers the row it retired or restored, as both routes do.
				expect(getNamedType(answered!.type).name).toBe(entry.answers);
				expect(isNonNullType(answered!.type)).toBe(true);
			}
		);

		it('states, on every one of the ten, the permission its own route states', () => {
			for (const { field, method, route, controller } of LIFECYCLE) {
				// The override is asserted to be there before the two readings are compared, because that is
				// what makes the route's own metadata the thing being mirrored rather than the inherited
				// handler's silence — the silence these overrides exist to replace.
				expect(typeof (controller.prototype as any)[route]).toBe('function');

				expect(Reflect.getMetadata(PERMISSIONS_METADATA, SellerEntityResolver.prototype[method])).toEqual(
					Reflect.getMetadata(PERMISSIONS_METADATA, controller.prototype[route])
				);
			}
		});

		it('states the destructive grant on all ten routes, which is what the pair takes', () => {
			// Read from the controllers rather than from a grant restated in this file, so the comparison
			// above cannot pass on two absences: the class-level grant of all five controllers is a `_VIEW`
			// value, and a route that stated nothing would leave the read grant in front of a write.
			for (const { field, route, controller } of LIFECYCLE) {
				expect({
					field,
					permission: Reflect.getMetadata(PERMISSIONS_METADATA, controller.prototype[route])
				}).toEqual({ field, permission: [PermissionsEnum.SELLERS_DELETE] });
			}
		});

		it.each(LIFECYCLE.map((entry) => entry.field))(
			'answers %s with the service method its route reaches, and with no other service’s row',
			async (field) => {
				const entry = LIFECYCLE.find((candidate) => candidate.field === field)!;
				const calls: Array<{ service: string; args: unknown[] }> = [];

				const returned = await writeResolver(calls)[entry.method](...CALLS[field].args);

				// Exactly one call, to the method the route reaches, with the identifier it was given. The
				// inherited route hands `softRemove` its rest parameter — an empty array — which the service
				// normalises to no find options; the call stated here is the one that normalisation reaches.
				// No seller scope is handed on, because the routes thread none: the scope is the access
				// guard's and the base service takes it nowhere, so a field that invented one would refuse a
				// caller the other protocol served.
				expect(calls).toEqual([{ service: entry.service, args: CALLS[field].args }]);

				// The row is the one only this resource's own service hands back, so a field wired to a
				// neighbouring resource's service — which states the same two method names — is caught here.
				expect(returned).toBe(LIFECYCLE_ROWS[entry.answers]);
			}
		);
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
			await resolver.updateSeller('seller-1', UPDATE_SELLER, context);
			await resolver.submitSeller('seller-1', context);
			await resolver.activateSeller('seller-1', context);
			await resolver.suspendSeller('seller-1', 'under review', context);
			await resolver.reinstateSeller('seller-1', context);
			await resolver.publishSellerOffering('offering-1', ['channel-1'], undefined, context);
			await resolver.pauseSellerOffering('offering-1', context);
			await resolver.withdrawSellerOffering('offering-1', context);
			await resolver.createSellerOffering(CREATE_OFFERING, undefined, context);
			await resolver.updateSellerOffering('offering-1', UPDATE_OFFERING, context);
			await resolver.retrySellerPayout('payout-1', undefined, context);

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
