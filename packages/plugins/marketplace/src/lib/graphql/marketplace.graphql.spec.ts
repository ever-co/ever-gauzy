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
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {},
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505')
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_METADATA } from '@nestjs/common/constants';
import {
	buildSchema,
	extendSchema,
	getNamedType,
	GraphQLEnumType,
	GraphQLObjectType,
	Kind,
	parse,
	print
} from 'graphql';
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
import { MarketplaceModule } from '../marketplace.module';
import { MarketplacePlugin } from '../marketplace.plugin';
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
 * The kernel declares the scalars and the three root operation types; a plugin extends the roots and
 * may never redeclare a type. Composing against this stub is what makes the assertion runnable with
 * no container, no database and no configuration — the same sequence the boot performs, on the part
 * of the schema this package is responsible for.
 */
const PLATFORM_STUB = `
	scalar DateTime
	scalar Decimal
	scalar JSON

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
 * The six services, doubled.
 *
 * Each returns the row its own aggregate carries, so a resolver method under test is the real one and
 * the only thing invented here is the store it reads.
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
		withdraw: async () => OFFERING
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

	return new SellerEntityResolver(
		sellerService as any,
		sellerOfferingService as any,
		sellerTransactionService as any,
		sellerPayoutService as any,
		sellerPayoutLineService as any,
		sellerSettlementService as any
	);
}

/** How each declared field is called, and the row its own type is read from. */
const CALLS: Record<string, { args: unknown[]; row: Record<string, unknown> }> = {
	sellers: { args: [], row: SELLER },
	seller: { args: ['seller-1'], row: SELLER },
	sellerStatement: { args: ['seller-1', 'USD'], row: STATEMENT },
	sellerBalance: { args: ['seller-1', 'USD'], row: BALANCE },
	sellerOfferings: { args: [], row: OFFERING },
	sellerTransactions: { args: [], row: TRANSACTION },
	sellerSplitReconciliation: { args: ['order-1', 'seller-1'], row: RECONCILIATION },
	sellerPayouts: { args: [], row: PAYOUT },
	sellerPayout: { args: ['payout-1'], row: PAYOUT },
	sellerPayoutLines: { args: ['payout-1'], row: PAYOUT_LINE },
	sellerSettlements: { args: [], row: SETTLEMENT },
	submitSeller: { args: ['seller-1'], row: SELLER },
	activateSeller: { args: ['seller-1'], row: SELLER },
	suspendSeller: { args: ['seller-1', 'under review'], row: SELLER },
	reinstateSeller: { args: ['seller-1'], row: SELLER },
	publishSellerOffering: { args: ['offering-1', ['channel-1']], row: OFFERING },
	pauseSellerOffering: { args: ['offering-1'], row: OFFERING },
	withdrawSellerOffering: { args: ['offering-1'], row: OFFERING },
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

/** The contract enum each GraphQL enum is the vocabulary of. */
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
	SellerHoldReason
};

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
});
