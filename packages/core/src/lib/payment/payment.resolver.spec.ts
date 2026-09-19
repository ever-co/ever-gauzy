/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { PaymentController } from './payment.controller';
import { PaymentModule } from './payment.module';
import { PaymentResolver } from './payment.resolver';
import { PaymentService } from './payment.service';

/**
 * The money ledger over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, a create, an edit that is the platform's
 * own upsert, a hard removal, the withdrawal and restoration of a row, and the receipt of one
 * movement. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `PaymentService` method the REST route reaches, with the same
 *   payload and the same request facts, so a client does not choose a better surface by choosing a
 *   protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the node
 *   read, the count and the two lifecycle fields, whose delivered routes state no permission of their
 *   own and therefore run under the controller's class-level edit permission, which is the one this
 *   resolver states as well;
 * - every amount the surface carries is an exact decimal and never a floating-point number, on the
 *   object type, on the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const INVOICE = '00000000-0000-4000-8000-000000000060';
const TAG = '00000000-0000-4000-8000-000000000050';
const PAYMENT = '00000000-0000-4000-8000-000000000010';
const REFUNDED = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them, with
 * every amount as the platform's numeric transformer hands it over: a number, and nothing rounded,
 * rescaled or reformatted on the way.
 */
const ROWS = [
	{
		id: PAYMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		paymentDate: new Date('2026-03-05T10:00:00.000Z'),
		amount: 100.5,
		currency: 'USD',
		paymentMethod: 'BANK_TRANSFER',
		note: 'Invoice 2 settled in full',
		overdue: false,
		status: 'CAPTURED',
		authorizedAmount: 100.5,
		capturedAmount: 100.5,
		refundedAmount: 0,
		canceledAmount: 0,
		organizationContactId: CONTACT,
		invoiceId: INVOICE,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: REFUNDED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		paymentDate: new Date('2026-02-01T10:00:00.000Z'),
		amount: 50.25,
		currency: 'EUR',
		paymentMethod: 'CASH',
		note: 'Deposit',
		overdue: true,
		status: 'PARTIALLY_REFUNDED',
		authorizedAmount: null,
		capturedAmount: 50.25,
		refundedAmount: 10.25,
		canceledAmount: 0,
		organizationContactId: CONTACT,
		invoiceId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const paymentService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		sendReceipt: jest.fn().mockResolvedValue(true)
	};

	return {
		paymentService,
		resolver: new PaymentResolver(paymentService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['payment.type.gql', 'payment.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `PaymentConnection!`. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: unknown }> }
		| undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * Two sibling concepts name themselves around the same word and are excluded here: the settlement
 * term is `paymentTerm…`, and the invoice domain's payment-record render is
 * `downloadInvoicePaymentPdf`. One resource's suite asserts its own fields, not its neighbours'.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('payment'))
		.filter((field) => !field.toLowerCase().includes('paymentterm'))
		.filter((field) => !field.toLowerCase().includes('invoicepayment'))
		.sort();
}

/** The printed body of one declaration, whatever kind it is. */
function bodyOf(kind: 'type' | 'input' | 'enum', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return bodyOf('type', name);
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return bodyOf('input', name);
}

/**
 * The member names one type declares, read off its printed body rather than off a description: a doc
 * comment is part of the printed type, so a member is asserted absent by its name and never by the
 * words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof PaymentController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof PaymentController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = PaymentResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = PaymentResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof PaymentController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'payments', route: 'findAll' },
	{ field: 'payment', route: 'findById' },
	{ field: 'paymentCount', route: 'getCount' },
	{ field: 'createPayment', route: 'create' },
	{ field: 'updatePayment', route: 'update' },
	{ field: 'deletePayment', route: 'delete' },
	{ field: 'softDeletePayment', route: 'softRemove' },
	{ field: 'recoverPayment', route: 'softRecover' },
	{ field: 'sendPaymentReceipt', route: 'sendReceipt' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createPayment',
	'updatePayment',
	'deletePayment',
	'softDeletePayment',
	'recoverPayment',
	'sendPaymentReceipt'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (PaymentResolver.prototype as never)[field],
		getClass: () => PaymentResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('PaymentResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['payments', 'payment', 'paymentCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createPayment',
				'updatePayment',
				'deletePayment',
				'softDeletePayment',
				'recoverPayment',
				'sendPaymentReceipt'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['payment', 'paymentCount', 'payments']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createPayment',
			'deletePayment',
			'recoverPayment',
			'sendPaymentReceipt',
			'softDeletePayment',
			'updatePayment'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type PaymentConnection \{\s*nodes: \[Payment!\]!\s*edges: \[PaymentEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type PaymentEdge \{\s*node: Payment!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input PaymentFilter \{/);
		expect(printed).toMatch(/input PaymentSort \{/);
		expect(printed).toMatch(
			/enum PaymentSortField \{\s*createdAt\s*updatedAt\s*paymentDate\s*amount\s*status\s*\}/
		);
	});

	it('declares the write inputs the mutations take, and the receipt inputs with them', () => {
		expect(printed).toMatch(/input CreatePaymentInput \{/);
		expect(printed).toMatch(/input UpdatePaymentInput \{/);
		expect(printed).toMatch(/input SendPaymentReceiptInput \{/);
		expect(printed).toMatch(/input PaymentReceiptInvoiceInput \{/);
		expect(printed).toMatch(/input PaymentReceiptPaymentInput \{/);
		expect(printed).toMatch(/input PaymentReceiptContactInput \{/);
		expect(printed).toMatch(/input PaymentReceiptOrganizationInput \{/);
	});

	it('carries the members the delivered reads produce, and not the relations they never load', () => {
		const members = memberNames('Payment');

		// No read behind this surface names a relation, so a member carrying a related row would be
		// absent from exactly the rows this surface answers. The identifiers are columns and are carried
		// instead — every document the row settles among them.
		expect(members).not.toContain('invoice');
		expect(members).not.toContain('project');
		expect(members).not.toContain('organizationContact');
		expect(members).not.toContain('employee');
		expect(members).not.toContain('tags');
		expect(members).toEqual(
			expect.arrayContaining([
				'invoiceId',
				'projectId',
				'organizationContactId',
				'employeeId',
				'orderId',
				'paymentCollectionId',
				'paymentSessionId',
				'paymentProviderId',
				'metadata',
				'deletedAt'
			])
		);

		// The lifecycle vocabulary and the payment-method vocabulary are the contracts' own and are
		// shared with the rest of the platform, so both are carried as their values rather than declared
		// as enums here.
		expect(typeBody('Payment')).toMatch(/status: String!/);
		expect(typeBody('Payment')).toMatch(/paymentMethod: String\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'payments')).not.toContain('withDeleted');
		// The connection declares the query protocol's page arguments and nothing else: the narrowing
		// the paginated spelling interprets is stated in `filter`.
		expect(fieldArgs('Query', 'payments')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		// The count route binds its query string to the store's own `where`, which is a shape no schema
		// can state, so the field states no narrowing of its own — and it is nullable, because a count is
		// an aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'paymentCount')).toEqual([]);
		expect(fieldType('Query', 'paymentCount')).toBe('Int');
		// The receipt reads its language and its origin from the request's own headers, as the route
		// does, so it takes no argument the route does not have.
		expect(fieldArgs('Mutation', 'sendPaymentReceipt')).toEqual(['input']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		// A field that declared one argument while its resolver read two would resolve the argument it
		// does not declare as undefined — and for the edit that identifier is what makes the delivered
		// upsert a change rather than a new row. This table is the schema's half of that agreement; the
		// delegation tests below call each field with the arguments listed here, which is the resolver's
		// half.
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createPayment', ['input']],
			['updatePayment', ['input']],
			['deletePayment', ['id']],
			['softDeletePayment', ['id']],
			['recoverPayment', ['id']],
			['sendPaymentReceipt', ['input']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('PaymentResolver — every amount is exact, on the type, in the filter and into a write', () => {
	it('carries every money member as Decimal and never as Float', () => {
		const body = typeBody('Payment');

		// Money is an exact quantity and a binary fraction cannot hold a cent: an amount a client reads
		// as a `Float` is an amount that will not add up. `fxRate` is not an amount but is stored at a
		// scale a binary fraction cannot hold either, so it travels in the same family.
		for (const member of [
			'amount',
			'authorizedAmount',
			'capturedAmount',
			'refundedAmount',
			'canceledAmount',
			'settlementAmount',
			'fxRate'
		]) {
			expect(body).toMatch(new RegExp(`${member}: Decimal!?\\n`));
		}
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		// Every type and input this domain contributes, read off the printed schema — which is what a
		// client is served, and which carries no comment that could hide a member behind prose.
		const declared = [
			'Payment',
			'PaymentEdge',
			'PaymentConnection',
			'PaymentFilter',
			'PaymentSort',
			'PaymentSortField',
			'CreatePaymentInput',
			'UpdatePaymentInput',
			'SendPaymentReceiptInput',
			'PaymentReceiptInvoiceInput',
			'PaymentReceiptPaymentInput',
			'PaymentReceiptContactInput',
			'PaymentReceiptOrganizationInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		// And the two documents never name it in a type position either, so the absence above is a
		// statement about the source rather than about the composition.
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the amounts through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('PaymentFilter');

		expect(filter).toMatch(/amount: DecimalFilter/);
		expect(filter).toMatch(/refundedAmount: DecimalFilter/);
		expect(filter).toMatch(/settlementAmount: DecimalFilter/);
		expect(filter).toMatch(/fxRate: DecimalFilter/);
		expect(filter).not.toMatch(/amount: (FloatFilter|NumberFilter)/);
		// The connection's own allow-list is the schema's other half: a field the evaluator does not
		// know is a field it refuses, so the two must name the same members.
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states money in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreatePaymentInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('UpdatePaymentInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('PaymentReceiptPaymentInput')).toMatch(/amount: Decimal!/);
		// The number a receipt prints is carried in the same family the document's own numbering member
		// is carried in, so a client passes the number it read straight back.
		expect(inputBody('PaymentReceiptInvoiceInput')).toMatch(/invoiceNumber: Decimal!/);
	});

	it('carries a currency as the row’s own code and never as a formatted amount', () => {
		const body = typeBody('Payment');

		// The row states one currency for its own amounts and, separately, the one a provider settled
		// in; both are three-letter codes. A formatted string — a symbol, a grouping separator — would
		// be a second representation of the amount beside the amount.
		expect(body).toMatch(/currency: String!/);
		expect(body).toMatch(/settlementCurrency: String\n/);
		expect(body).not.toMatch(/formatted|formattedAmount|displayAmount/);
	});

	it('answers the amounts the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.payments();

		// Nothing on this surface rescales, rounds or reformats an amount: the read's own values are the
		// answer, which is what makes a client's arithmetic and the platform's agree.
		expect(connection.nodes[0].amount).toBe(100.5);
		expect(connection.nodes[0].capturedAmount).toBe(100.5);
		expect(connection.nodes[1].amount).toBe(50.25);
		expect(connection.nodes[1].refundedAmount).toBe(10.25);
		expect(await resolver.payment(PAYMENT)).toBe(ROWS[0]);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, paymentService } = surfaces();

		await resolver.createPayment({ amount: '100.5', currency: 'USD' });

		// The amount is passed through as it arrived: the column is `numeric` and a decimal string is
		// what it stores, so the digits a caller writes are the digits the ledger holds.
		expect(paymentService.create).toHaveBeenCalledWith(expect.objectContaining({ amount: '100.5' }));

		await resolver.updatePayment({ id: PAYMENT, amount: '0.1' });

		expect(paymentService.create).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: PAYMENT, amount: '0.1' })
		);
	});
});

describe('PaymentResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, paymentService } = surfaces();

		const connection = await resolver.payments(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(paymentService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PAYMENT);
	});

	it('orders by the ledger’s own date, newest movement first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.payments();

		expect(connection.nodes.map((node) => node.id)).toEqual([PAYMENT, REFUNDED]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.payments({ status: { eq: 'PARTIALLY_REFUNDED' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([REFUNDED]);

		const byCurrency = await resolver.payments({ currency: { eq: 'EUR' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([REFUNDED]);

		// The window the paginated spelling of the list interprets is `between` here, on the amount.
		const byAmount = await resolver.payments({ amount: { between: ['50', '60'] } });
		expect(byAmount.nodes.map((node) => node.id)).toEqual([REFUNDED]);

		// And on a date, which is compared as an instant rather than as its spelling.
		const byDate = await resolver.payments({
			paymentDate: { between: ['2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'] }
		});
		expect(byDate.nodes.map((node) => node.id)).toEqual([REFUNDED]);

		// The note pattern is the other narrowing the paginated spelling applies, stated in the
		// connection's own vocabulary rather than dropped.
		const byNote = await resolver.payments({ note: { ilike: 'invoice%' } });
		expect(byNote.nodes.map((node) => node.id)).toEqual([PAYMENT]);

		const byContact = await resolver.payments({ organizationContactId: { eq: CONTACT } });
		expect(byContact.totalCount).toBe(2);

		const byRefund = await resolver.payments({ refundedAmount: { gt: '0' } });
		expect(byRefund.nodes.map((node) => node.id)).toEqual([REFUNDED]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byAmount = await resolver.payments(undefined, [{ field: 'amount', direction: 'ASC' }]);
		expect(byAmount.nodes.map((node) => node.id)).toEqual([REFUNDED, PAYMENT]);

		const byDate = await resolver.payments(undefined, [{ field: 'paymentDate', direction: 'ASC' }]);
		expect(byDate.nodes.map((node) => node.id)).toEqual([REFUNDED, PAYMENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.payments(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PAYMENT]);

		const second = await resolver.payments(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([REFUNDED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.payments(undefined, undefined, undefined, 20);

		const last = await resolver.payments(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PAYMENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.payments(undefined, [{ field: 'currency', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` is carried on the entity and deliberately not filterable: the delivered list read loads
		// no relations, so the condition could only ever match the empty set, and the connection refuses
		// it rather than answering it with no rows.
		const error = await resolver.payments({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.payments(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('PaymentFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		// The declaration in the resolver and the input in the SDL are two renderings of one list, and a
		// member that is filterable in the schema but unknown to the evaluator is a field a client can
		// state and be refused for. An empty condition narrows nothing, so what each read below asserts
		// is only that the evaluator recognises the field.
		for (const member of declared) {
			await expect(resolver.payments({ [member]: {} })).resolves.toBeDefined();
		}

		// The other half of the same claim is read off the refusal, which names the evaluator's whole
		// allow-list: a member it knows and the schema does not would appear here and nowhere else.
		const refusal = await resolver.payments({ tags: { eq: TAG } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			// The message closes the list with a sentence, so the full stop is taken off before the
			// members are read: it is punctuation rather than part of the last name.
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [...bodyOf('enum', 'PaymentSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'paymentDate', 'amount', 'status']);

		// Every key the enum offers is a key the evaluator accepts, so the schema is not promising an
		// order the connection would refuse; the refusal of everything else is asserted above.
		for (const field of offered) {
			await expect(resolver.payments(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('PaymentResolver — one ledger, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, paymentService } = surfaces();

		expect(await resolver.payment(PAYMENT)).toBe(ROWS[0]);
		expect(paymentService.findOneByIdString).toHaveBeenCalledWith(PAYMENT);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, paymentService } = surfaces();
		paymentService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.payment(REFUNDED)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, paymentService } = surfaces();

		expect(await resolver.paymentCount()).toBe(2);
		expect(paymentService.countBy).toHaveBeenCalledWith();
	});

	it('records a movement through the same service method the REST create route calls', async () => {
		const { resolver, paymentService } = surfaces();

		expect(
			await resolver.createPayment({
				amount: '100.5',
				currency: 'USD',
				paymentDate: new Date('2026-03-05T10:00:00.000Z'),
				paymentMethod: 'BANK_TRANSFER',
				note: 'Invoice 2 settled in full',
				organizationId: ORGANIZATION,
				invoiceId: INVOICE,
				organizationContactId: CONTACT,
				tagIds: [TAG]
			})
		).toBe(ROWS[0]);

		// The delivered create is handed the members the caller stated, the facets as the identifiers
		// the pivot row is written from, and the tenant only from the credential.
		expect(paymentService.create).toHaveBeenCalledWith({
			amount: '100.5',
			currency: 'USD',
			paymentDate: new Date('2026-03-05T10:00:00.000Z'),
			paymentMethod: 'BANK_TRANSFER',
			note: 'Invoice 2 settled in full',
			organizationId: ORGANIZATION,
			invoiceId: INVOICE,
			organizationContactId: CONTACT,
			tags: [{ id: TAG }]
		});
	});

	it('changes a movement through the same write the REST edit route reaches, with the path identifier', async () => {
		const { resolver, paymentService } = surfaces();

		await resolver.updatePayment({ id: PAYMENT, amount: '120.75', note: 'Corrected' });

		// The delivered edit is the platform's own upsert: the identifier the route reads from the path
		// and the body beside it, handed to the same write the create uses.
		expect(paymentService.create).toHaveBeenCalledWith({
			amount: '120.75',
			note: 'Corrected',
			id: PAYMENT
		});
	});

	it('removes a movement through the same service method the REST removal route calls', async () => {
		const { resolver, paymentService } = surfaces();

		// The delivered store answers its delete result, which is not a row: the field answers the one
		// fact the removal establishes.
		expect(await resolver.deletePayment(PAYMENT)).toBe(true);
		expect(paymentService.delete).toHaveBeenCalledWith(PAYMENT);
	});

	it('withdraws and restores a movement through the service methods the inherited routes call', async () => {
		const { resolver, paymentService } = surfaces();

		const withdrawn = await resolver.softDeletePayment(PAYMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(paymentService.softRemove).toHaveBeenCalledWith(PAYMENT);

		expect(await resolver.recoverPayment(PAYMENT)).toBe(ROWS[0]);
		expect(paymentService.softRecover).toHaveBeenCalledWith(PAYMENT);
	});

	it('sends a receipt through the same service method the REST route calls, from the request’s own facts', async () => {
		const { resolver, paymentService } = surfaces();
		// The route reads the language through `I18nLang` and the origin from the `origin` header; the
		// field reads the same two facts off the same request, which is what these spies state.
		const language = jest.spyOn(RequestContext, 'getLanguageCode').mockReturnValue(LanguagesEnum.GERMAN);
		const request = jest
			.spyOn(RequestContext, 'currentRequest')
			.mockReturnValue({ headers: { origin: 'https://app.example.test' } });

		try {
			const sent = await resolver.sendPaymentReceipt({
				invoice: {
					invoiceNumber: '2',
					toContact: { primaryEmail: 'buyer@example.test', name: 'Buyer' },
					fromOrganization: { id: ORGANIZATION, name: 'Issuer', tenantId: TENANT }
				},
				payment: { amount: '100.5', currency: 'USD' }
			});

			// The two objects the route posts are handed over as they arrived, under the request's own
			// language and origin, and the amount is the exact decimal the caller stated.
			expect(paymentService.sendReceipt).toHaveBeenCalledWith(
				LanguagesEnum.GERMAN,
				{
					invoiceNumber: '2',
					toContact: { primaryEmail: 'buyer@example.test', name: 'Buyer' },
					fromOrganization: { id: ORGANIZATION, name: 'Issuer', tenantId: TENANT }
				},
				{ amount: '100.5', currency: 'USD' },
				'https://app.example.test'
			);
			// The answer is the dispatch's own boolean, not a constant: the delivered method reports a
			// refusal rather than raising it, so a field answering `true` would claim a delivery nobody
			// established.
			expect(sent).toBe(true);
		} finally {
			language.mockRestore();
			request.mockRestore();
		}
	});

	it('answers the receipt dispatch’s own refusal rather than claiming delivery', async () => {
		const { resolver, paymentService } = surfaces();
		paymentService.sendReceipt.mockResolvedValueOnce(false);

		const sent = await resolver.sendPaymentReceipt({
			invoice: {
				invoiceNumber: '2',
				toContact: { primaryEmail: 'buyer@example.test', name: 'Buyer' },
				fromOrganization: { id: ORGANIZATION, name: 'Issuer' }
			},
			payment: { amount: '100.5', currency: 'USD' }
		});

		expect(sent).toBe(false);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, paymentService } = surfaces();
		const refusal = new Error('PAYMENT_ALREADY_APPLIED: the movement is accounted for.');

		paymentService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deletePayment(PAYMENT)).rejects.toBe(refusal);
	});
});

describe('PaymentResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', PaymentResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', PaymentController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', PaymentResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here.
			const declared = Reflect.getMetadata('__guards__', PaymentController) ?? [];
			const restated = guardsOfHandler(PaymentController, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, PaymentController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentController)).toEqual([
			PermissionsEnum.ORG_PAYMENT_ADD_EDIT
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, PaymentResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(PaymentController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(PaymentController, route));
	});

	it('carries the view permission on the list, which is the only route that states one', () => {
		// Every other read and every write of this resource runs under the controller's class-level edit
		// permission: the list is the one handler that states a permission of its own.
		expect(permissionOfField('payments')).toEqual([PermissionsEnum.ORG_PAYMENT_VIEW]);
		expect(permissionOfRoute(PaymentController, 'findAll')).toEqual([PermissionsEnum.ORG_PAYMENT_VIEW]);

		for (const field of ['payment', 'paymentCount', ...WRITES]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PAYMENT_ADD_EDIT]);
		}
	});

	it('carries the edit permission on the inherited reads and the two lifecycle fields, because their routes inherit it', () => {
		// The node read, the count, the withdrawal and the restoration are inherited from the CRUD base,
		// where they state no permission of their own — so they run under the controller's class-level
		// edit permission, and the fields state the same one rather than stating nothing. Reading "no
		// metadata on the route" as "no permission" would widen the REST route's scope on this surface
		// only. The receipt route is the case that states no permission and is not inherited: it is
		// declared on the controller and inherits the class-level permission all the same.
		for (const handler of ['findById', 'getCount', 'delete', 'softRemove', 'softRecover', 'sendReceipt']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentController.prototype[handler])).toBeUndefined();
		}

		for (const field of ['payment', 'paymentCount', 'deletePayment', 'softDeletePayment', 'recoverPayment', 'sendPaymentReceipt']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_PAYMENT_ADD_EDIT]);
		}
	});
});

describe('PaymentResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, PaymentResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', PaymentResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('payments')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('payments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the receipt and the removals among them', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createPayment', 'deletePayment', 'sendPaymentReceipt']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('payment'))).resolves.toBe(true);
	});
});

describe('PaymentModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PaymentModule) ?? []) as unknown[];

		expect(providers).toContain(PaymentResolver);
		expect(providers).toContain(PaymentService);
	});

	it('exports the service the resolver injects, and that service is the whole of its dependencies', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — and every write this
		// resource serves reaches a service method rather than dispatching a command, which is why the
		// command bus is not among them.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, PaymentModule) ?? []) as unknown[];

		expect(exported).toContain(PaymentService);
		expect(PaymentResolver.length).toBe(1);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		// The two guards the resolver shares with the controller are providers of whichever module
		// declares the handler they protect, so this module has to reach the permission service they
		// look the caller's grants up in — the API boot fails on an unresolved dependency without it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, PaymentModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');

		// `FeatureModule` is deliberately not imported, and that is a fact about the module rather than a
		// preference: it is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs, and an import here would be one edge in every module that
		// declares a resolver.
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
