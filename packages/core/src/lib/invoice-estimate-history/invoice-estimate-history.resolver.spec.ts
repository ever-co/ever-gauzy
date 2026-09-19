/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryResolver } from './invoice-estimate-history.resolver';

/**
 * The invoice estimate history over GraphQL.
 *
 * The delivered REST routes list the log of what happened to a document, read one entry, count the log,
 * and create, edit, remove, withdraw and restore an entry — the last three inherited from the CRUD base.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain and the permission are read field by field from the controller's own metadata**:
 *   the controller states nothing on its class and one pair of guards and one permission on its list
 *   handler, so exactly one field states them and the rest state nothing beyond the gate;
 * - the two relations no delivered read joins are not members, and neither is `deletedAt` a filter;
 * - an entry that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INVOICE = '00000000-0000-4000-8000-000000000003';
const USER = '00000000-0000-4000-8000-000000000004';
const CREATED = '00000000-0000-4000-8000-000000000010';
const SENT = '00000000-0000-4000-8000-000000000011';

/** The log entries a scripted reader answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: CREATED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		invoiceId: INVOICE,
		userId: USER,
		action: 'Invoice created',
		title: 'Draft',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		invoiceId: INVOICE,
		userId: USER,
		action: 'Invoice sent',
		title: null,
		createdAt: new Date('2026-03-02T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const invoiceEstimateHistoryService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		invoiceEstimateHistoryService,
		resolver: new InvoiceEstimateHistoryResolver(invoiceEstimateHistoryService as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('invoiceestimatehistor'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input object, so a member no filter declares can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof InvoiceEstimateHistoryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof InvoiceEstimateHistoryController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof InvoiceEstimateHistoryController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = InvoiceEstimateHistoryResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = InvoiceEstimateHistoryResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', InvoiceEstimateHistoryResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('InvoiceEstimateHistoryResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the node and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'invoiceEstimateHistories',
				'invoiceEstimateHistory',
				'invoiceEstimateHistoryCount'
			])
		);
	});

	it('declares one mutation per delivered write route, the inherited ones included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createInvoiceEstimateHistory',
				'updateInvoiceEstimateHistory',
				'deleteInvoiceEstimateHistory',
				'softDeleteInvoiceEstimateHistory',
				'recoverInvoiceEstimateHistory'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'invoiceEstimateHistories',
			'invoiceEstimateHistory',
			'invoiceEstimateHistoryCount'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createInvoiceEstimateHistory',
			'deleteInvoiceEstimateHistory',
			'recoverInvoiceEstimateHistory',
			'softDeleteInvoiceEstimateHistory',
			'updateInvoiceEstimateHistory'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type InvoiceEstimateHistoryConnection \{\s*nodes: \[InvoiceEstimateHistory!\]!\s*edges: \[InvoiceEstimateHistoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type InvoiceEstimateHistoryEdge \{\s*node: InvoiceEstimateHistory!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input InvoiceEstimateHistoryFilter \{/);
		expect(printed).toMatch(/input InvoiceEstimateHistorySort \{/);
		expect(printed).toMatch(
			/enum InvoiceEstimateHistorySortField \{\s*createdAt\s*updatedAt\s*action\s*title\s*\}/
		);
	});

	it('carries the identifiers of the relations no delivered read joins', () => {
		const body = typeBody('InvoiceEstimateHistory');

		expect(body).toMatch(/action: String!/);
		expect(body).toMatch(/userId: ID/);
		expect(body).toMatch(/invoiceId: ID/);
		// The list read joins only what a REST caller names and the node read joins nothing, so a member
		// for either relation would be present or absent depending on the request that produced the row.
		expect(body).not.toMatch(/\buser: User/);
		expect(body).not.toMatch(/\binvoice: Invoice/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/invoiceEstimateHistories\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/invoiceEstimateHistoryCount\(/);
		// The count is a nullable number: a non-null field would turn "not answered" into a zero.
		expect(printed).toMatch(/invoiceEstimateHistoryCount: Int\b/);
		// The withdrawn marker is not a filter, because it is absent on every row the read answers.
		expect(inputBody('InvoiceEstimateHistoryFilter')).not.toMatch(/\bdeletedAt:/);
	});
});

describe('InvoiceEstimateHistoryResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		const connection = await resolver.invoiceEstimateHistories(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same service method, with the
		// route's own default for an unstated request: no criterion and no relations.
		expect(invoiceEstimateHistoryService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SENT);
	});

	it('reads the log newest entry first when the caller states no order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invoiceEstimateHistories();

		expect(connection.nodes.map((node) => node.id)).toEqual([SENT, CREATED]);
	});

	it('narrows by the fields the filter declares, including the document the log is about', async () => {
		const { resolver } = surfaces();

		const byInvoice = await resolver.invoiceEstimateHistories({ invoiceId: { eq: INVOICE } });
		expect(byInvoice.totalCount).toBe(2);

		const byAction = await resolver.invoiceEstimateHistories({ action: { eq: 'Invoice sent' } });
		expect(byAction.nodes.map((node) => node.id)).toEqual([SENT]);

		const withoutTitle = await resolver.invoiceEstimateHistories({ title: { isNull: true } });
		expect(withoutTitle.nodes.map((node) => node.id)).toEqual([SENT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byAction = await resolver.invoiceEstimateHistories(undefined, [
			{ field: 'action', direction: 'ASC' }
		]);
		expect(byAction.nodes.map((node) => node.id)).toEqual([CREATED, SENT]);

		const byCreated = await resolver.invoiceEstimateHistories(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([CREATED, SENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.invoiceEstimateHistories(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SENT]);

		const second = await resolver.invoiceEstimateHistories(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([CREATED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.invoiceEstimateHistories(undefined, undefined, undefined, 20);

		const last = await resolver.invoiceEstimateHistories(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoiceEstimateHistories(undefined, [{ field: 'invoiceId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoiceEstimateHistories({ invoice: { eq: INVOICE } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invoiceEstimateHistories(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('InvoiceEstimateHistoryResolver — one concept, two protocols, the same operations', () => {
	it('reads one entry through the same service method the REST route calls', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		expect(await resolver.invoiceEstimateHistory(CREATED)).toBe(ROWS[0]);
		expect(invoiceEstimateHistoryService.findOneByIdString).toHaveBeenCalledWith(CREATED);
	});

	it('answers null for an entry that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();
		invoiceEstimateHistoryService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.invoiceEstimateHistory(SENT)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		expect(await resolver.invoiceEstimateHistoryCount()).toBe(2);
		expect(invoiceEstimateHistoryService.countBy).toHaveBeenCalledWith({});
	});

	it('files an entry through the same service method the inherited create route calls', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		await resolver.createInvoiceEstimateHistory({
			action: 'Invoice created',
			title: 'Draft',
			invoiceId: INVOICE,
			userId: USER,
			organizationId: ORGANIZATION
		});

		expect(invoiceEstimateHistoryService.create).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'Invoice created', invoiceId: INVOICE })
		);
	});

	it('changes an entry through the same service method the REST route calls, and reads it back', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		await resolver.updateInvoiceEstimateHistory({ id: CREATED, title: 'Corrected' });

		expect(invoiceEstimateHistoryService.update).toHaveBeenCalledWith(CREATED, { title: 'Corrected' });
		// The delivered route answers the store's own update result, so the row is read back.
		expect(invoiceEstimateHistoryService.findOneByIdString).toHaveBeenLastCalledWith(CREATED);
	});

	it('removes an entry through the same service method the REST route calls', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		expect(await resolver.deleteInvoiceEstimateHistory(CREATED)).toBe(true);
		expect(invoiceEstimateHistoryService.delete).toHaveBeenCalledWith(CREATED);
	});

	it('withdraws and restores an entry through the inherited routes’ service methods', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();

		const withdrawn = await resolver.softDeleteInvoiceEstimateHistory(CREATED);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(invoiceEstimateHistoryService.softRemove).toHaveBeenCalledWith(CREATED);

		expect(await resolver.recoverInvoiceEstimateHistory(CREATED)).toBe(ROWS[0]);
		expect(invoiceEstimateHistoryService.softRecover).toHaveBeenCalledWith(CREATED);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, invoiceEstimateHistoryService } = surfaces();
		const refusal = new Error('INVOICE_ESTIMATE_HISTORY_LOCKED: the entry belongs to a settled invoice.');

		invoiceEstimateHistoryService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteInvoiceEstimateHistory(CREATED)).rejects.toBe(refusal);
	});
});

describe('InvoiceEstimateHistoryResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver field by field, as the controller states its guards', () => {
		const routes: Array<[string, string]> = [
			['invoiceEstimateHistories', 'findAll'],
			['invoiceEstimateHistory', 'findById'],
			['invoiceEstimateHistoryCount', 'getCount'],
			['createInvoiceEstimateHistory', 'create'],
			['updateInvoiceEstimateHistory', 'update'],
			['deleteInvoiceEstimateHistory', 'delete'],
			['softDeleteInvoiceEstimateHistory', 'softRemove'],
			['recoverInvoiceEstimateHistory', 'softRecover']
		];

		for (const [field, handler] of routes) {
			// The controller states nothing on its class, so the class here carries the gate alone and each
			// field supplies exactly what its own route supplies — which for the list is the guards and the
			// permission the list route states on itself, and for the rest is nothing at all.
			expect([...guardsOfRoute(InvoiceEstimateHistoryController, handler), FeatureFlagGuard].sort()).toEqual(
				[...guardsOfField(field)].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceEstimateHistoryController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoiceEstimateHistoryResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['invoiceEstimateHistories', 'findAll'],
			['invoiceEstimateHistory', 'findById'],
			['invoiceEstimateHistoryCount', 'getCount'],
			['createInvoiceEstimateHistory', 'create'],
			['updateInvoiceEstimateHistory', 'update'],
			['deleteInvoiceEstimateHistory', 'delete'],
			['softDeleteInvoiceEstimateHistory', 'softRemove'],
			['recoverInvoiceEstimateHistory', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(InvoiceEstimateHistoryController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the invoice view permission on the list alone, because only its route states one', () => {
		// The list route states the pair of guards and the permission on itself; the controller's class
		// states neither, and the CRUD base's own routes state neither either.
		expect(permissionOfField('invoiceEstimateHistories')).toEqual([PermissionsEnum.INVOICES_VIEW]);
		expect(Reflect.getMetadata('__guards__', handlersOf(InvoiceEstimateHistoryController)['findAll'])).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		for (const field of [
			'invoiceEstimateHistory',
			'invoiceEstimateHistoryCount',
			'createInvoiceEstimateHistory',
			'updateInvoiceEstimateHistory',
			'deleteInvoiceEstimateHistory',
			'softDeleteInvoiceEstimateHistory',
			'recoverInvoiceEstimateHistory'
		]) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
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
		getHandler: () => (InvoiceEstimateHistoryResolver.prototype as never)[field],
		getClass: () => InvoiceEstimateHistoryResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('InvoiceEstimateHistoryResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, InvoiceEstimateHistoryResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', InvoiceEstimateHistoryResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('invoiceEstimateHistories'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('invoiceEstimateHistories');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('invoiceEstimateHistories'))).resolves.toBe(true);
	});
});
