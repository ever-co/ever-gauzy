/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InvoiceModule } from './invoice.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceResolver } from './invoice.resolver';
import { InvoiceService } from './invoice.service';
import {
	InvoiceCreateCommand,
	InvoiceDeleteCommand,
	InvoiceGenerateLinkCommand,
	InvoiceGeneratePdfCommand,
	InvoicePaymentGeneratePdfCommand,
	InvoiceSendEmailCommand,
	InvoiceUpdateCommand
} from './commands';
// The module is imported before the controller it declares, and that order is not cosmetic: this
// domain's barrel (`./index`) re-exports the module while the service imports the barrel for its two
// PDF builders, so entering the graph through the controller would decorate the module while the
// service is still being defined and its provider list would be captured with holes in it. The
// application enters through the module — `app.module.ts`, `stats.module.ts` and
// `estimate-email.module.ts` all import `../invoice/invoice.module` — so the suite enters the same
// way and asserts what the application actually boots with.

/**
 * The finance document over GraphQL.
 *
 * The delivered REST routes serve a list, one document, a count, the series' highest number, the two
 * rendered documents, the create, the edit, the buyer's answer, an action, an email, a public link,
 * the removal and the two lifecycle moves. This suite pins the half of the two-protocol doctrine that
 * is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method or dispatches the same command the REST route reaches,
 *   with the same payload and the same request facts, so a client does not choose a better surface by
 *   choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the two
 *   lifecycle fields, whose delivered routes state no permission of their own and therefore run under
 *   the controller's class-level edit permission, which is the one this resolver states as well;
 * - every amount the surface carries is an exact decimal and never a floating-point number, and the
 *   numbering series is carried in that same family;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ISSUER = '00000000-0000-4000-8000-000000000003';
const INVOICE = '00000000-0000-4000-8000-000000000010';
const ESTIMATE = '00000000-0000-4000-8000-000000000011';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const TAG = '00000000-0000-4000-8000-000000000050';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

const PDF_BYTES = Buffer.from('%PDF-1.4 an invoice');

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them, with
 * every amount as the platform's numeric transformer hands it over: a number.
 */
const ROWS = [
	{
		id: INVOICE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		invoiceNumber: 2,
		invoiceDate: new Date('2026-03-05T00:00:00.000Z'),
		dueDate: new Date('2026-04-04T00:00:00.000Z'),
		currency: 'USD',
		discountValue: 0,
		discountType: 'FLAT',
		paid: false,
		tax: 10.5,
		taxType: 'PERCENT',
		tax2: 0,
		tax2Type: 'PERCENT',
		terms: 'Net 30',
		totalValue: 100.5,
		status: 'SENT',
		isEstimate: false,
		isAccepted: null,
		invoiceType: 'DETAILED_ITEMS',
		sentTo: 'buyer@example.test',
		organizationContactId: CONTACT,
		internalNote: null,
		alreadyPaid: 0,
		amountDue: 100.5,
		hasRemainingAmountInvoiced: true,
		token: null,
		fromOrganizationId: ISSUER,
		toContactId: CONTACT,
		isArchived: false,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: ESTIMATE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		invoiceNumber: 1,
		invoiceDate: new Date('2026-02-01T00:00:00.000Z'),
		dueDate: new Date('2026-02-28T00:00:00.000Z'),
		currency: 'EUR',
		discountValue: 5,
		discountType: 'PERCENT',
		paid: null,
		tax: 0,
		taxType: 'FLAT',
		tax2: 0,
		tax2Type: 'FLAT',
		terms: 'On acceptance',
		totalValue: 50.25,
		status: 'DRAFT',
		isEstimate: true,
		isAccepted: false,
		invoiceType: 'DETAILED_ITEMS',
		sentTo: null,
		organizationContactId: CONTACT,
		internalNote: 'quoted for the spring order',
		alreadyPaid: null,
		amountDue: null,
		hasRemainingAmountInvoiced: null,
		token: 'a-token',
		fromOrganizationId: ISSUER,
		toContactId: CONTACT,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const invoiceService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getHighestInvoiceNumber: jest.fn().mockResolvedValue({ max: '2' }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = {
		execute: jest.fn((command: any) =>
			command instanceof InvoiceGeneratePdfCommand || command instanceof InvoicePaymentGeneratePdfCommand
				? Promise.resolve(PDF_BYTES)
				: Promise.resolve(ROWS[0])
		)
	};

	return {
		invoiceService,
		commandBus,
		resolver: new InvoiceResolver(invoiceService as never, commandBus as never)
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

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
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
 * The billed line is the sibling domain's concept and names itself `invoiceItem`, so it is excluded
 * here: one resource's suite asserts its own fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('invoice'))
		.filter((field) => !field.toLowerCase().includes('invoiceitem'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The member names one object type declares, read off its printed body rather than off a description:
 * a doc comment is part of the printed type, so a member is asserted absent by its name and never by
 * the words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof InvoiceController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof InvoiceController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = InvoiceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = InvoiceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof InvoiceController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

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
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (InvoiceResolver.prototype as never)[field],
		getClass: () => InvoiceResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
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
	{ field: 'invoices', route: 'findAll' },
	{ field: 'invoice', route: 'findById' },
	{ field: 'invoiceCount', route: 'getCount' },
	{ field: 'highestInvoiceNumber', route: 'findHighestInvoiceNumber' },
	{ field: 'downloadInvoicePdf', route: 'downloadInvoicePdf' },
	{ field: 'downloadInvoicePaymentPdf', route: 'downloadInvoicePaymentPdf' },
	{ field: 'createInvoice', route: 'create' },
	{ field: 'updateInvoice', route: 'update' },
	{ field: 'updateInvoiceEstimate', route: 'updateEstimate' },
	{ field: 'updateInvoiceAction', route: 'updateAction' },
	{ field: 'sendInvoiceEmail', route: 'emailInvoice' },
	{ field: 'generateInvoiceLink', route: 'generateLink' },
	{ field: 'deleteInvoice', route: 'delete' },
	{ field: 'softDeleteInvoice', route: 'softRemove' },
	{ field: 'recoverInvoice', route: 'softRecover' }
];

/** The read fields, which carry the view permission, and the write fields, which carry the edit one. */
const READS = ['invoices', 'invoice', 'invoiceCount', 'highestInvoiceNumber'];

/** The write fields, whose commands are asserted one by one below. */
const WRITES = [
	'createInvoice',
	'updateInvoice',
	'updateInvoiceEstimate',
	'updateInvoiceAction',
	'sendInvoiceEmail',
	'generateInvoiceLink',
	'deleteInvoice',
	'softDeleteInvoice',
	'recoverInvoice'
];

describe('InvoiceResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the series look-up', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['invoices', 'invoice', 'invoiceCount', 'highestInvoiceNumber'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createInvoice',
				'updateInvoice',
				'updateInvoiceEstimate',
				'updateInvoiceAction',
				'sendInvoiceEmail',
				'generateInvoiceLink',
				'deleteInvoice',
				'softDeleteInvoice',
				'recoverInvoice'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(
			['invoices', 'invoice', 'invoiceCount', 'highestInvoiceNumber', 'downloadInvoicePdf', 'downloadInvoicePaymentPdf'].sort()
		);
		expect(ownedRootFields('Mutation')).toEqual(
			[
				'createInvoice',
				'updateInvoice',
				'updateInvoiceEstimate',
				'updateInvoiceAction',
				'sendInvoiceEmail',
				'generateInvoiceLink',
				'deleteInvoice',
				'softDeleteInvoice',
				'recoverInvoice'
			].sort()
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type InvoiceConnection \{\s*nodes: \[Invoice!\]!\s*edges: \[InvoiceEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type InvoiceEdge \{\s*node: Invoice!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input InvoiceFilter \{/);
		expect(printed).toMatch(/input InvoiceSort \{/);
		expect(printed).toMatch(
			/enum InvoiceSortField \{\s*createdAt\s*updatedAt\s*invoiceNumber\s*invoiceDate\s*dueDate\s*totalValue\s*amountDue\s*status\s*\}/
		);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateInvoiceInput \{/);
		expect(printed).toMatch(/input UpdateInvoiceInput \{/);
		expect(printed).toMatch(/input UpdateInvoiceActionInput \{/);
		expect(printed).toMatch(/input SendInvoiceEmailInput \{/);
	});

	it('declares the answer the series look-up and the two renders give', () => {
		// The delivered look-up's own return type says `Invoice` while its statement selects the
		// aggregate row, so the surface states the row it actually answers.
		expect(memberNames('InvoiceNumberSeries')).toEqual(['max']);
		expect(printed).toMatch(/type InvoiceNumberSeries \{[\s\S]*?max: Decimal!\s*\}/);
		// A GraphQL answer has no binary scalar: the rendered document travels as the bytes it is,
		// with the media type and the length the REST routes state in their headers.
		expect(memberNames('InvoiceDocument')).toEqual(['contentType', 'byteLength', 'content']);
		expect(printed).toMatch(
			/type InvoiceDocument \{[\s\S]*?contentType: String![\s\S]*?byteLength: Int![\s\S]*?content: String!\s*\}/
		);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'invoices')).not.toContain('withDeleted');
		// The connection declares the query protocol's page arguments and nothing else: the narrowing
		// the paginated spelling interprets is stated in `filter`, and the relations its node sibling
		// can name are not offered at all.
		expect(fieldArgs('Query', 'invoices')).toEqual([
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
		expect(fieldArgs('Query', 'invoices')).not.toContain('relations');
		// The count route binds its query string to the store's own `where`, which is a shape no schema
		// can state, so the field states no narrowing of its own.
		expect(fieldArgs('Query', 'invoiceCount')).toEqual([]);
		// The two renders read their locale from the request's own header, as the routes do, so neither
		// takes an argument the route does not have.
		expect(fieldArgs('Query', 'downloadInvoicePdf')).toEqual(['id']);
		expect(fieldArgs('Query', 'downloadInvoicePaymentPdf')).toEqual(['id']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		// A field that declared one argument while its resolver read two would resolve the argument it
		// does not declare as undefined — and for the action write that identifier is what makes the
		// delivered upsert a change rather than a new row. This table is the schema's half of that
		// agreement; the delegation tests below call each field with the arguments listed here, which is
		// the resolver's half.
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createInvoice', ['input']],
			['updateInvoice', ['input']],
			['updateInvoiceEstimate', ['id', 'isAccepted']],
			['updateInvoiceAction', ['id', 'input']],
			['sendInvoiceEmail', ['input']],
			['generateInvoiceLink', ['id']],
			['deleteInvoice', ['id']],
			['softDeleteInvoice', ['id']],
			['recoverInvoice', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('InvoiceResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, invoiceService } = surfaces();

		const connection = await resolver.invoices(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(invoiceService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(INVOICE);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invoices();

		expect(connection.nodes.map((node) => node.id)).toEqual([INVOICE, ESTIMATE]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.invoices({ status: { eq: 'DRAFT' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		const byKind = await resolver.invoices({ isEstimate: { eq: false } });
		expect(byKind.nodes.map((node) => node.id)).toEqual([INVOICE]);

		const byCurrency = await resolver.invoices({ currency: { eq: 'EUR' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		// The window the paginated spelling of the list interprets is `between` here, on the amount.
		const byTotal = await resolver.invoices({ totalValue: { between: ['50', '60'] } });
		expect(byTotal.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		// And on a date, which is compared as an instant rather than as its spelling.
		const byDueDate = await resolver.invoices({
			dueDate: { between: ['2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'] }
		});
		expect(byDueDate.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		const byContact = await resolver.invoices({ toContactId: { eq: CONTACT } });
		expect(byContact.totalCount).toBe(2);

		const bySeries = await resolver.invoices({ invoiceNumber: { gte: '2' } });
		expect(bySeries.nodes.map((node) => node.id)).toEqual([INVOICE]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byNumber = await resolver.invoices(undefined, [{ field: 'invoiceNumber', direction: 'ASC' }]);
		expect(byNumber.nodes.map((node) => node.id)).toEqual([ESTIMATE, INVOICE]);

		const byTotal = await resolver.invoices(undefined, [{ field: 'totalValue', direction: 'DESC' }]);
		expect(byTotal.nodes.map((node) => node.id)).toEqual([INVOICE, ESTIMATE]);

		const byDueDate = await resolver.invoices(undefined, [{ field: 'dueDate', direction: 'ASC' }]);
		expect(byDueDate.nodes.map((node) => node.id)).toEqual([ESTIMATE, INVOICE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.invoices(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([INVOICE]);

		const second = await resolver.invoices(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ESTIMATE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.invoices(undefined, undefined, undefined, 20);

		const last = await resolver.invoices(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([INVOICE]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoices(undefined, [{ field: 'token', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `deletedAt` is carried on the object and deliberately not filterable: the delivered list read
		// answers live rows only, so the connection refuses the condition rather than answering it with
		// the empty set.
		const error = await resolver.invoices({ deletedAt: { isNull: false } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoices(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('InvoiceResolver — one concept, two protocols, the same operations', () => {
	it('reads one document through the same service method the REST node route calls', async () => {
		const { resolver, invoiceService } = surfaces();

		expect(await resolver.invoice(INVOICE)).toBe(ROWS[0]);
		// The node route reads with the relations its `data` query string names; this surface states
		// none, which is the route's own default.
		expect(invoiceService.findOneByIdString).toHaveBeenCalledWith(INVOICE, { relations: [] });
	});

	it('answers null for a document that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, invoiceService } = surfaces();
		invoiceService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.invoice(ESTIMATE)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, invoiceService } = surfaces();

		expect(await resolver.invoiceCount()).toBe(2);
		expect(invoiceService.countBy).toHaveBeenCalledWith();
	});

	it('answers the series through the service method the look-up route calls', async () => {
		const { resolver, invoiceService } = surfaces();

		// The delivered method's signature says `Invoice` and its answer is the aggregate row; the field
		// answers exactly what the method answers rather than inventing a document around it.
		expect(await resolver.highestInvoiceNumber()).toEqual({ max: '2' });
		expect(invoiceService.getHighestInvoiceNumber).toHaveBeenCalledWith();
	});

	it('renders the document through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const document = await resolver.downloadInvoicePdf(INVOICE);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceGeneratePdfCommand);
		expect(command.invoiceId).toBe(INVOICE);
		// The locale is the request's own, which is what the route's `I18nLang` decorator resolves; no
		// request is in flight in this suite, so it is the decorator's own default.
		expect(command.locale).toBe(LanguagesEnum.ENGLISH);
		// The answer is the shape the SDL declares rather than nothing: the bytes, the media type and
		// the exact length the REST route states in `Content-Length`.
		expect(document).toEqual({
			contentType: 'application/pdf',
			byteLength: PDF_BYTES.length,
			content: PDF_BYTES.toString('base64')
		});
	});

	it('renders the payment record through the command that route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const document = await resolver.downloadInvoicePaymentPdf(INVOICE);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoicePaymentGeneratePdfCommand);
		expect(command.invoiceId).toBe(INVOICE);
		expect(document?.contentType).toBe('application/pdf');
	});

	it('answers null when the renderer answered nothing, which is the route’s own empty body', async () => {
		const { resolver, commandBus } = surfaces();
		// The delivered renderer logs a failure rather than raising it, and the route answers an empty
		// body in that case — which is a nullable answer rather than a refusal.
		commandBus.execute.mockResolvedValueOnce(undefined);

		expect(await resolver.downloadInvoicePdf(INVOICE)).toBeNull();
	});

	it('raises a document through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createInvoice({
			invoiceNumber: '3',
			invoiceDate: new Date('2026-03-10T00:00:00.000Z'),
			dueDate: new Date('2026-04-09T00:00:00.000Z'),
			status: 'DRAFT',
			currency: 'USD',
			fromOrganizationId: ISSUER,
			organizationId: ORGANIZATION,
			totalValue: '100.5',
			tax: '10.5',
			tagIds: [TAG]
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceCreateCommand);
		expect(command.input).toEqual({
			invoiceNumber: '3',
			invoiceDate: new Date('2026-03-10T00:00:00.000Z'),
			dueDate: new Date('2026-04-09T00:00:00.000Z'),
			status: 'DRAFT',
			currency: 'USD',
			fromOrganizationId: ISSUER,
			organizationId: ORGANIZATION,
			totalValue: '100.5',
			tax: '10.5',
			// A facet is carried as the identifier the pivot row is written from, never as a tag row
			// beside it.
			tags: [{ id: TAG }]
		});
	});

	it('edits a document through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateInvoice({
			id: INVOICE,
			invoiceNumber: '2',
			invoiceDate: new Date('2026-03-05T00:00:00.000Z'),
			dueDate: new Date('2026-04-04T00:00:00.000Z'),
			status: 'SENT',
			currency: 'USD',
			totalValue: '100.5',
			tagIds: [TAG, CONTACT]
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceUpdateCommand);
		expect(command.input).toEqual({
			id: INVOICE,
			invoiceNumber: '2',
			invoiceDate: new Date('2026-03-05T00:00:00.000Z'),
			dueDate: new Date('2026-04-04T00:00:00.000Z'),
			status: 'SENT',
			currency: 'USD',
			totalValue: '100.5',
			tags: [{ id: TAG }, { id: CONTACT }]
		});
	});

	it('records the buyer’s answer through the command the estimate route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateInvoiceEstimate(ESTIMATE, true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceUpdateCommand);
		// The route's body is exactly this one member, added to the identifier the path names.
		expect(command.input).toEqual({ id: ESTIMATE, isAccepted: true });
	});

	it('moves a document along through the command the action route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateInvoiceAction(INVOICE, {
			status: 'FULLY_PAID',
			paid: true,
			alreadyPaid: '100.5',
			amountDue: '0'
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceUpdateCommand);
		// A step writes the members it names and leaves every other column as it is: nothing here fills
		// in a member the caller did not state.
		expect(command.input).toEqual({
			id: INVOICE,
			status: 'FULLY_PAID',
			paid: true,
			alreadyPaid: '100.5',
			amountDue: '0'
		});
	});

	it('sends the document through the command the REST route dispatches, from the request’s own facts', async () => {
		const { resolver, commandBus } = surfaces();
		// The route reads the language through `I18nLang` and the origin from the `origin` header; the
		// field reads the same two facts off the same request, which is what these spies state.
		const language = jest.spyOn(RequestContext, 'getLanguageCode').mockReturnValue(LanguagesEnum.GERMAN);
		const request = jest
			.spyOn(RequestContext, 'currentRequest')
			.mockReturnValue({ headers: { origin: 'https://app.example.test' } });

		try {
			const sent = await resolver.sendInvoiceEmail({
				email: 'buyer@example.test',
				invoiceId: INVOICE,
				invoiceNumber: '2',
				isEstimate: false,
				organizationId: ORGANIZATION
			});

			const command = commandBus.execute.mock.calls[0][0];
			expect(command).toBeInstanceOf(InvoiceSendEmailCommand);
			expect(command.languageCode).toBe(LanguagesEnum.GERMAN);
			expect(command.email).toBe('buyer@example.test');
			expect(command.origin).toBe('https://app.example.test');
			// The route's `params` body member is the document the message is about.
			expect(command.params).toEqual({
				invoiceNumber: '2',
				invoiceId: INVOICE,
				isEstimate: false,
				organizationId: ORGANIZATION
			});
			// The answer states the one fact the dispatch establishes: that it ran. The delivered
			// dispatcher logs its own failures, so the field cannot claim delivery, and the SDL says so.
			expect(sent).toBe(true);
		} finally {
			language.mockRestore();
			request.mockRestore();
		}
	});

	it('generates the link through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.generateInvoiceLink(INVOICE)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceGenerateLinkCommand);
		expect(command.invoiceId).toBe(INVOICE);
	});

	it('removes a document through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteInvoice(INVOICE)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceDeleteCommand);
		expect(command.invoiceId).toBe(INVOICE);
	});

	it('withdraws and recovers a document through the service methods the inherited routes call', async () => {
		const { resolver, invoiceService } = surfaces();

		const withdrawn = await resolver.softDeleteInvoice(INVOICE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(invoiceService.softRemove).toHaveBeenCalledWith(INVOICE);

		expect(await resolver.recoverInvoice(INVOICE)).toBe(ROWS[0]);
		expect(invoiceService.softRecover).toHaveBeenCalledWith(INVOICE);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, invoiceService } = surfaces();
		const refusal = new Error('INVOICE_PAYMENTS_APPLIED: a payment is applied against this document.');

		invoiceService.softRemove.mockRejectedValueOnce(refusal);

		await expect(resolver.softDeleteInvoice(INVOICE)).rejects.toBe(refusal);
	});
});

describe('InvoiceResolver — every amount is exact, and the numbering series with it', () => {
	it('carries every money member as Decimal and never as Float', () => {
		const body = typeBody('Invoice');

		// Money is an exact quantity and a binary fraction cannot hold a cent: an amount a client reads
		// as a `Float` is an amount that will not add up.
		for (const member of ['discountValue', 'tax', 'tax2', 'totalValue', 'alreadyPaid', 'amountDue']) {
			expect(body).toMatch(new RegExp(`${member}: Decimal`));
		}
		expect(body).not.toMatch(/(discountValue|tax|tax2|totalValue|alreadyPaid|amountDue): Float/);
	});

	it('carries the numbering series in the same exact family, and not as a Float or a 32-bit Int', () => {
		const body = typeBody('Invoice');

		// The column is `numeric` (a `bigint` on the store that declares it so) and the series is what
		// the next document's number is derived from, so the platform's 32-bit `Int` would refuse a
		// series the column holds while a `Float` could not hold it at all.
		expect(body).toMatch(/invoiceNumber: Decimal/);
		expect(body).not.toMatch(/invoiceNumber: (Float|Int)/);
		expect(printed).toMatch(/type InvoiceNumberSeries \{[\s\S]*?max: Decimal!\s*\}/);
	});

	it('states one currency for every amount on the document rather than one per amount', () => {
		const body = typeBody('Invoice');

		// The row has a single `currency` column, so pairing an amount with a code of its own would be
		// inventing a second answer to a question the document already answers once.
		expect(body).toMatch(/currency: String!/);
		expect(body).not.toMatch(/discountValueCurrency|totalValueCurrency/);
	});

	it('narrows the amounts through the decimal family, never through a whole-number one', () => {
		expect(printed).toMatch(/input InvoiceFilter \{[\s\S]*?totalValue: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).toMatch(/input InvoiceFilter \{[\s\S]*?discountValue: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).toMatch(/input InvoiceFilter \{[\s\S]*?invoiceNumber: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).not.toMatch(/input InvoiceFilter \{[\s\S]*?totalValue: (FloatFilter|NumberFilter)[\s\S]*?\n\}/);
	});

	it('answers the amounts the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invoices();

		// Nothing on this surface rescales, rounds or reformats an amount: the read's own values are the
		// answer, which is what makes a client's arithmetic and the platform's agree.
		expect(connection.nodes[0].totalValue).toBe(100.5);
		expect(connection.nodes[0].tax).toBe(10.5);
		expect(connection.nodes[1].totalValue).toBe(50.25);
		expect(connection.nodes[1].discountValue).toBe(5);
		expect(await resolver.invoice(INVOICE)).toBe(ROWS[0]);
	});

	it('carries no member the delivered readers cannot produce', () => {
		const members = memberNames('Invoice');

		// The invoice has no translation rows and no reader merges one, so a translated member would be
		// absent from every row this surface answers.
		expect(members).not.toContain('translations');
		// Relations are loaded only when a REST caller names them in `relations`, and no read this
		// surface performs names any; the identifiers are columns and are carried instead.
		expect(members).not.toContain('fromOrganization');
		expect(members).not.toContain('toContact');
		expect(members).not.toContain('invoiceItems');
		expect(members).not.toContain('payments');
		expect(members).not.toContain('historyRecords');
		expect(members).not.toContain('tags');
		expect(members).toEqual(expect.arrayContaining(['fromOrganizationId', 'toContactId', 'deletedAt', 'token']));
		// The write DTO carries a contact name that no column holds and no write stores.
		expect(members).not.toContain('organizationContactName');
	});
});

describe('InvoiceResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', InvoiceResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', InvoiceController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller
		// with no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', InvoiceResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here.
			const declared = Reflect.getMetadata('__guards__', InvoiceController) ?? [];
			const restated = guardsOfHandler(InvoiceController, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceController)).toEqual([PermissionsEnum.INVOICES_EDIT]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(InvoiceController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(InvoiceController, route));
	});

	it('carries the view permission on every read and the edit permission on every write', () => {
		// The reads are the fields whose routes state the view permission, the two renders included; the
		// writes are every field whose route inherits the controller's class-level edit permission.
		for (const field of [...READS, 'downloadInvoicePdf', 'downloadInvoicePaymentPdf']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.INVOICES_VIEW]);
		}

		for (const field of WRITES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.INVOICES_EDIT]);
		}
	});

	it('carries the edit permission on the two lifecycle fields, because their routes inherit it', () => {
		// The withdrawal and the restoration are inherited from the CRUD base, where they state no
		// permission of their own — so they run under the controller's class-level edit permission, and
		// the fields state the same one rather than stating nothing. Reading "no metadata on the route"
		// as "no permission" would widen the REST route's scope on this surface only.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceController.prototype.softRemove)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceController.prototype.softRecover)).toBeUndefined();
		expect(permissionOfRoute(InvoiceController, 'softRemove')).toEqual([PermissionsEnum.INVOICES_EDIT]);
		expect(permissionOfField('softDeleteInvoice')).toEqual([PermissionsEnum.INVOICES_EDIT]);
		expect(permissionOfField('recoverInvoice')).toEqual([PermissionsEnum.INVOICES_EDIT]);
	});
});

describe('InvoiceResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, InvoiceResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', InvoiceResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('invoices')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('invoices');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, including the removal and the public link', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createInvoice', 'deleteInvoice', 'generateInvoiceLink']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('invoice'))).resolves.toBe(true);
	});
});

describe('InvoiceModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InvoiceModule) ?? []) as unknown[];

		expect(providers).toContain(InvoiceResolver);
		expect(providers).toContain(InvoiceService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, InvoiceModule) ?? []) as unknown[];

		expect(exported).toContain(InvoiceService);
		expect(exported).toContain(CqrsModule);
	});

	it('reaches the module that provides the feature service the gate resolves through', () => {
		// The gate is a guard, and a guard is a provider of whichever module declares the handler it
		// protects — so this module is what has to reach `FeatureService`, and the API boot fails on an
		// unresolved dependency without it. The entry is stated plainly rather than deferred: nothing the
		// feature side loads reaches this module, so there is no cycle for a `forwardRef` to break.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, InvoiceModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(FeatureModule);
	});
});
