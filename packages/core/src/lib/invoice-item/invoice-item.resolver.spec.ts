/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemModule } from './invoice-item.module';
import { InvoiceItemResolver } from './invoice-item.resolver';
import { InvoiceItemService } from './invoice-item.service';
import { InvoiceItemBulkCreateCommand } from './commands';

/**
 * One billed line over GraphQL.
 *
 * The delivered REST routes serve a list, one line, a count, the create, the edit, the removal, the
 * two lifecycle moves and the bulk write. This suite pins the half of the two-protocol doctrine that
 * is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method or dispatches the same command the REST route reaches,
 *   so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and the permissions are the routes'** — this controller
 *   carries the tenant guard and no class-level permission, so no field states one except the bulk
 *   write, whose own route is the one route that states `PermissionGuard` and the invoice edit
 *   permission;
 * - every amount and the quantity are exact decimals and never floating-point numbers.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INVOICE = '00000000-0000-4000-8000-000000000010';
const OTHER_INVOICE = '00000000-0000-4000-8000-000000000011';
const LINE = '00000000-0000-4000-8000-000000000020';
const OTHER_LINE = '00000000-0000-4000-8000-000000000021';
const PRODUCT = '00000000-0000-4000-8000-000000000030';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: LINE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		description: 'Two days of work',
		price: 250.5,
		quantity: 2,
		totalValue: 501,
		applyTax: true,
		applyDiscount: false,
		invoiceId: INVOICE,
		productId: null,
		taskId: null,
		employeeId: null,
		projectId: null,
		expenseId: null,
		purchaseOrderLineId: null,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: OTHER_LINE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		description: 'A stocked item',
		price: 10.25,
		quantity: 0.5,
		totalValue: 5.125,
		applyTax: false,
		applyDiscount: true,
		invoiceId: OTHER_INVOICE,
		productId: PRODUCT,
		taskId: null,
		employeeId: null,
		projectId: null,
		expenseId: null,
		purchaseOrderLineId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const invoiceItemService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS) };

	return {
		invoiceItemService,
		commandBus,
		resolver: new InvoiceItemResolver(invoiceItemService as never, commandBus as never)
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
 * The document these lines belong to is the invoice domain's concept and names itself `invoice`, so
 * every field this domain owns carries the line's own name: one resource's suite asserts its own
 * fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('invoiceitem'))
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
function handlersOf(controller: typeof InvoiceItemController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof InvoiceItemController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = InvoiceItemResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = InvoiceItemResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof InvoiceItemController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'invoiceItems', route: 'findAll' },
	{ field: 'invoiceItem', route: 'findById' },
	{ field: 'invoiceItemCount', route: 'getCount' },
	{ field: 'createInvoiceItem', route: 'create' },
	{ field: 'updateInvoiceItem', route: 'update' },
	{ field: 'deleteInvoiceItem', route: 'delete' },
	{ field: 'softDeleteInvoiceItem', route: 'softRemove' },
	{ field: 'recoverInvoiceItem', route: 'softRecover' },
	{ field: 'createInvoiceItemsInBulk', route: 'createBulk' }
];

describe('InvoiceItemResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['invoiceItems', 'invoiceItem', 'invoiceItemCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createInvoiceItem',
				'updateInvoiceItem',
				'deleteInvoiceItem',
				'softDeleteInvoiceItem',
				'recoverInvoiceItem',
				'createInvoiceItemsInBulk'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — its own `GET /` and the `GET /pagination` it inherits —
		// and the two answer one question, so the surface states it once.
		expect(ownedRootFields('Query')).toEqual(['invoiceItems', 'invoiceItem', 'invoiceItemCount'].sort());
		expect(ownedRootFields('Mutation')).toEqual(
			[
				'createInvoiceItem',
				'updateInvoiceItem',
				'deleteInvoiceItem',
				'softDeleteInvoiceItem',
				'recoverInvoiceItem',
				'createInvoiceItemsInBulk'
			].sort()
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type InvoiceItemConnection \{\s*nodes: \[InvoiceItem!\]!\s*edges: \[InvoiceItemEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type InvoiceItemEdge \{\s*node: InvoiceItem!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input InvoiceItemFilter \{/);
		expect(printed).toMatch(/input InvoiceItemSort \{/);
		expect(printed).toMatch(
			/enum InvoiceItemSortField \{\s*createdAt\s*updatedAt\s*price\s*quantity\s*totalValue\s*\}/
		);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateInvoiceItemInput \{/);
		expect(printed).toMatch(/input UpdateInvoiceItemInput \{/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'invoiceItems')).not.toContain('withDeleted');
		// The narrowing the delivered route's `data` query string carries is stated in `filter`, and the
		// relations it can name are not offered at all.
		expect(fieldArgs('Query', 'invoiceItems')).not.toContain('relations');
		expect(fieldArgs('Query', 'invoiceItems')).not.toContain('findInput');
		expect(fieldArgs('Query', 'invoiceItems')).toEqual([
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
		// can state, so the field states no narrowing of its own.
		expect(fieldArgs('Query', 'invoiceItemCount')).toEqual([]);
		// The bulk write names the document once and carries the lines as its one input list.
		expect(fieldArgs('Mutation', 'createInvoiceItemsInBulk')).toEqual(['invoiceId', 'input']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		// This table is the schema's half of that agreement; the delegation tests below call each field
		// with the arguments listed here, which is the resolver's half.
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createInvoiceItem', ['input']],
			['updateInvoiceItem', ['input']],
			['deleteInvoiceItem', ['id']],
			['softDeleteInvoiceItem', ['id']],
			['recoverInvoiceItem', ['id']],
			['createInvoiceItemsInBulk', ['invoiceId', 'input']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('InvoiceItemResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, invoiceItemService } = surfaces();

		const connection = await resolver.invoiceItems(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(invoiceItemService.findAll).toHaveBeenCalledWith({ relations: [] });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LINE);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invoiceItems();

		expect(connection.nodes.map((node) => node.id)).toEqual([LINE, OTHER_LINE]);
	});

	it('narrows by the fields the filter declares, the document first among them', async () => {
		const { resolver } = surfaces();

		// A document's own screen reads its lines by narrowing the list to that document.
		const byDocument = await resolver.invoiceItems({ invoiceId: { eq: INVOICE } });
		expect(byDocument.nodes.map((node) => node.id)).toEqual([LINE]);
		expect(byDocument.totalCount).toBe(1);

		const byProduct = await resolver.invoiceItems({ productId: { eq: PRODUCT } });
		expect(byProduct.nodes.map((node) => node.id)).toEqual([OTHER_LINE]);

		const byFlags = await resolver.invoiceItems({ applyTax: { eq: true } });
		expect(byFlags.nodes.map((node) => node.id)).toEqual([LINE]);

		// The quantity is compared in the exact family it is multiplied in, and the amounts with it.
		const byQuantity = await resolver.invoiceItems({ quantity: { between: ['0', '1'] } });
		expect(byQuantity.nodes.map((node) => node.id)).toEqual([OTHER_LINE]);

		const byTotal = await resolver.invoiceItems({ totalValue: { gte: '100' } });
		expect(byTotal.nodes.map((node) => node.id)).toEqual([LINE]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byPrice = await resolver.invoiceItems(undefined, [{ field: 'price', direction: 'ASC' }]);
		expect(byPrice.nodes.map((node) => node.id)).toEqual([OTHER_LINE, LINE]);

		const byTotal = await resolver.invoiceItems(undefined, [{ field: 'totalValue', direction: 'DESC' }]);
		expect(byTotal.nodes.map((node) => node.id)).toEqual([LINE, OTHER_LINE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.invoiceItems(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([LINE]);

		const second = await resolver.invoiceItems(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_LINE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.invoiceItems(undefined, undefined, undefined, 20);

		const last = await resolver.invoiceItems(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([LINE]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoiceItems(undefined, [{ field: 'invoiceId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `deletedAt` is carried on the object and deliberately not filterable: the delivered list read
		// answers live rows only, so the connection refuses the condition rather than answering it with
		// the empty set.
		const error = await resolver.invoiceItems({ deletedAt: { isNull: false } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoiceItems(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('InvoiceItemResolver — one concept, two protocols, the same operations', () => {
	it('reads one line through the same service method the REST node route calls', async () => {
		const { resolver, invoiceItemService } = surfaces();

		expect(await resolver.invoiceItem(LINE)).toBe(ROWS[0]);
		expect(invoiceItemService.findOneByIdString).toHaveBeenCalledWith(LINE, { relations: [] });
	});

	it('answers null for a line that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, invoiceItemService } = surfaces();
		invoiceItemService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.invoiceItem(OTHER_LINE)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, invoiceItemService } = surfaces();

		expect(await resolver.invoiceItemCount()).toBe(2);
		expect(invoiceItemService.countBy).toHaveBeenCalledWith();
	});

	it('records a line through the same service method the REST route calls', async () => {
		const { resolver, invoiceItemService } = surfaces();

		expect(
			await resolver.createInvoiceItem({
				description: 'Two days of work',
				price: '250.5',
				quantity: '2',
				totalValue: '501',
				invoiceId: INVOICE,
				organizationId: ORGANIZATION,
				applyTax: true
			})
		).toBe(ROWS[0]);

		// The delivered create takes the body as it is stated and stamps the caller's own tenant onto
		// the row, which is why the tenant is not a member of the input.
		expect(invoiceItemService.create).toHaveBeenCalledWith({
			description: 'Two days of work',
			price: '250.5',
			quantity: '2',
			totalValue: '501',
			invoiceId: INVOICE,
			organizationId: ORGANIZATION,
			applyTax: true
		});
	});

	it('edits a line through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, invoiceItemService } = surfaces();

		const updated = await resolver.updateInvoiceItem({ id: LINE, quantity: '3', totalValue: '751.5' });

		// The identifier is the criterion and is not among the columns the statement writes, which is the
		// shape the route has: `:id` names the row and the body carries what changes.
		expect(invoiceItemService.update).toHaveBeenCalledWith(LINE, { quantity: '3', totalValue: '751.5' });
		// The delivered route answers the store's own update result, which is not a row; the field reads
		// the row back through the same service, which is the shape the SDL declares.
		expect(invoiceItemService.findOneByIdString).toHaveBeenCalledWith(LINE);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a line through the same service method the REST route calls', async () => {
		const { resolver, invoiceItemService } = surfaces();

		expect(await resolver.deleteInvoiceItem(LINE)).toBe(true);
		expect(invoiceItemService.delete).toHaveBeenCalledWith(LINE);
	});

	it('withdraws and recovers a line through the same service methods the inherited routes call', async () => {
		const { resolver, invoiceItemService } = surfaces();

		const withdrawn = await resolver.softDeleteInvoiceItem(LINE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(invoiceItemService.softRemove).toHaveBeenCalledWith(LINE);

		expect(await resolver.recoverInvoiceItem(LINE)).toBe(ROWS[0]);
		expect(invoiceItemService.softRecover).toHaveBeenCalledWith(LINE);
	});

	it('stores a document’s whole line set through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const lines = await resolver.createInvoiceItemsInBulk(INVOICE, [
			{ description: 'Two days of work', price: '250.5', quantity: '2', totalValue: '501', invoiceId: INVOICE }
		]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvoiceItemBulkCreateCommand);
		// The document is named twice and neither statement is redundant: the argument is what the
		// removal narrows by, and each line's own `invoiceId` is what attaches it.
		expect(command.invoiceId).toBe(INVOICE);
		expect(command.input).toEqual([
			{ description: 'Two days of work', price: '250.5', quantity: '2', totalValue: '501', invoiceId: INVOICE }
		]);
		// The answer is the set that was stored, which is what the route answers.
		expect(lines).toBe(ROWS);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, invoiceItemService } = surfaces();
		const refusal = new Error('INVOICE_ITEM_NOT_EDITABLE: the document of this line is settled.');

		invoiceItemService.update.mockRejectedValueOnce(refusal);

		await expect(resolver.updateInvoiceItem({ id: LINE, quantity: '3' })).rejects.toBe(refusal);
	});
});

describe('InvoiceItemResolver — every amount and the quantity are exact', () => {
	it('carries the two amounts and the quantity as Decimal and never as Float', () => {
		const body = typeBody('InvoiceItem');

		// Money is an exact quantity and a binary fraction cannot hold a cent; the quantity is exact for
		// the same reason, because it is the factor the line's total is the product of.
		for (const member of ['price', 'quantity', 'totalValue']) {
			expect(body).toMatch(new RegExp(`${member}: Decimal`));
		}
		expect(body).not.toMatch(/(price|quantity|totalValue): Float/);
	});

	it('carries no currency of its own, because the document states it', () => {
		const members = memberNames('InvoiceItem');

		// The table has no currency column here: every line of a document is expressed in the currency
		// the document states, and a code beside an amount would be a second answer to that question.
		expect(members).not.toContain('currency');
		expect(members.filter((member) => member.toLowerCase().includes('currency'))).toEqual([]);
	});

	it('narrows the amounts and the quantity through the decimal family', () => {
		expect(printed).toMatch(/input InvoiceItemFilter \{[\s\S]*?price: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).toMatch(/input InvoiceItemFilter \{[\s\S]*?quantity: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).toMatch(/input InvoiceItemFilter \{[\s\S]*?totalValue: DecimalFilter[\s\S]*?\n\}/);
		expect(printed).not.toMatch(/input InvoiceItemFilter \{[\s\S]*?totalValue: (FloatFilter|NumberFilter)/);
	});

	it('answers the amounts the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invoiceItems();

		// Nothing on this surface rescales, rounds or reformats a value: the read's own values are the
		// answer, which is what makes a line's total agree with the platform's arithmetic over it.
		expect(connection.nodes[0].price).toBe(250.5);
		expect(connection.nodes[0].quantity).toBe(2);
		expect(connection.nodes[0].totalValue).toBe(501);
		expect(connection.nodes[1].quantity).toBe(0.5);
		expect(connection.nodes[1].totalValue).toBe(5.125);
	});

	it('carries no member the delivered reads cannot produce', () => {
		const body = typeBody('InvoiceItem');

		// Relations are loaded only when a REST caller names them in `relations`, and no read this
		// surface performs names any; the identifiers are columns and are carried instead.
		for (const relation of ['invoice:', 'product:', 'project:', 'employee:', 'task:', 'expense:']) {
			expect(body).not.toContain(relation);
		}
		expect(body).toMatch(/invoiceId: ID/);
		expect(body).toMatch(/productId: ID/);
		expect(body).toMatch(/purchaseOrderLineId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
	});
});

describe('InvoiceItemResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, on the tenant alone', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', InvoiceItemResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', InvoiceItemController) ?? [];

		expect(resolverGuards).toEqual([TenantPermissionGuard]);
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		// The permission guard is stated by the bulk route's handler rather than by the controller, so
		// neither surface demands a permission the other does not before that route's own guard runs.
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceItemResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceItemController)).toBeUndefined();
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceItemResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(InvoiceItemController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(InvoiceItemController, route));
	});

	it('carries the edit permission on the bulk write alone, because its route is the one route that does', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceItemController.prototype.createBulk)).toEqual([
			PermissionsEnum.INVOICES_EDIT
		]);
		expect(Reflect.getMetadata('__guards__', InvoiceItemController.prototype.createBulk)).toEqual([
			PermissionGuard
		]);
		expect(permissionOfField('createInvoiceItemsInBulk')).toEqual([PermissionsEnum.INVOICES_EDIT]);
		expect(guardsOfField('createInvoiceItemsInBulk')).toEqual([PermissionGuard]);

		// Every other field is as wide as its route and no wider: those routes state no permission, so
		// neither do they.
		for (const { field } of PERMISSION_PARITY.filter((entry) => entry.route !== 'createBulk')) {
			expect(permissionOfField(field)).toBeUndefined();
			expect(guardsOfField(field)).toEqual([]);
		}
	});

	it('mirrors the inherited routes’ own permissions, which are the controller’s and are none', () => {
		// The list, the node read and the count are overridden by this controller; the create, the edit,
		// the removal and the two lifecycle moves are inherited from the CRUD base, which states no
		// permission on any of them. Reading "no metadata" as "no permission" is right here and wrong
		// for a controller that carries a class-level one — which is why this suite compares metadata
		// rather than assuming either answer.
		for (const handler of ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceItemController.prototype[handler])).toBeUndefined();
			expect(permissionOfRoute(InvoiceItemController, handler)).toBeUndefined();
		}
	});
});

describe('InvoiceItemModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InvoiceItemModule) ?? []) as unknown[];

		expect(providers).toContain(InvoiceItemResolver);
		expect(providers).toContain(InvoiceItemService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, InvoiceItemModule) ?? []) as unknown[];

		expect(exported).toContain(InvoiceItemService);
		expect(exported).toContain(CqrsModule);
	});
});
