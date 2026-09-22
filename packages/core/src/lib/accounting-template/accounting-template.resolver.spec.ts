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
import { AccountingTemplateTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateResolver } from './accounting-template.resolver';
import { AccountingTemplateQuery } from './queries';

/**
 * The accounting templates over GraphQL.
 *
 * The delivered REST routes list the templates, read one, count them, resolve the template a record of
 * one type is rendered through, convert a document for preview, save a document, create, edit, remove,
 * withdraw and restore. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same query, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's**, including on the fields whose routes the
 *   controller inherits from the CRUD base rather than declaring;
 * - the resolved lookup and the preview are root fields of their own rather than filters over the list,
 *   because neither answers a page of rows;
 * - a template that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INVOICE = '00000000-0000-4000-8000-000000000010';
const ESTIMATE = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted reader answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: INVOICE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'invoice',
		languageCode: 'en',
		templateType: AccountingTemplateTypeEnum.INVOICE,
		mjml: '<mjml><body>Invoice</body></mjml>',
		hbs: '<html><body>Invoice</body></html>',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: ESTIMATE,
		tenantId: null,
		organizationId: null,
		name: 'estimate',
		languageCode: 'en',
		templateType: AccountingTemplateTypeEnum.ESTIMATE,
		mjml: '<mjml><body>Estimate</body></mjml>',
		hbs: '<html><body>Estimate</body></html>',
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and query bus. */
function surfaces() {
	const accountingTemplateService = {
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getAccountTemplate: jest.fn().mockResolvedValue(ROWS[0]),
		generatePreview: jest.fn().mockResolvedValue({ html: '<html><body>Invoice</body></html>' }),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		findOneByWhereOptions: jest.fn().mockResolvedValue(ROWS[0]),
		saveTemplate: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const queryBus = { execute: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }) };

	return {
		accountingTemplateService,
		queryBus,
		resolver: new AccountingTemplateResolver(accountingTemplateService as never, queryBus as never)
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
		.filter((field) => field.toLowerCase().includes('accountingtemplate'))
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
function handlersOf(controller: typeof AccountingTemplateController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof AccountingTemplateController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof AccountingTemplateController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = AccountingTemplateResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = AccountingTemplateResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', AccountingTemplateResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('AccountingTemplateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the node, the count, the resolved lookup and the preview', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'accountingTemplates',
				'accountingTemplate',
				'accountingTemplateCount',
				'accountingTemplateFor',
				'accountingTemplatePreview'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createAccountingTemplate',
				'updateAccountingTemplate',
				'deleteAccountingTemplate',
				'softDeleteAccountingTemplate',
				'recoverAccountingTemplate',
				'saveAccountingTemplate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'accountingTemplate',
			'accountingTemplateCount',
			'accountingTemplateFor',
			'accountingTemplatePreview',
			'accountingTemplates'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createAccountingTemplate',
			'deleteAccountingTemplate',
			'recoverAccountingTemplate',
			'saveAccountingTemplate',
			'softDeleteAccountingTemplate',
			'updateAccountingTemplate'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type AccountingTemplateConnection \{\s*nodes: \[AccountingTemplate!\]!\s*edges: \[AccountingTemplateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type AccountingTemplateEdge \{\s*node: AccountingTemplate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input AccountingTemplateFilter \{/);
		expect(printed).toMatch(/input AccountingTemplateSort \{/);
		expect(printed).toMatch(
			/enum AccountingTemplateSortField \{\s*createdAt\s*updatedAt\s*name\s*languageCode\s*templateType\s*\}/
		);
	});

	it('carries the source and the compiled body, and not the relation the routes do not agree on', () => {
		const body = typeBody('AccountingTemplate');

		expect(body).toMatch(/mjml: String/);
		expect(body).toMatch(/hbs: String/);
		// The list read joins `organization` on one ORM branch and the node read on none, so a member for
		// the relation would be present or absent depending on the installation and the route.
		expect(body).not.toMatch(/\borganization: Organization/);
		expect(body).toMatch(/organizationId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The value set belongs to the platform's contract package, so the member carries its value.
		expect(body).toMatch(/templateType: String/);
	});

	it('offers no argument it cannot honour', () => {
		// The read hands its options to `findAll`, which carries `withDeleted` to the store on both dialects, so the connection offers it — the same visibility the REST list route inherits from `BaseQueryDTO`.
		expect(printed).toMatch(/accountingTemplates\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/accountingTemplateCount\(/);
		// The count is a nullable number: a non-null field would turn "not answered" into a zero.
		expect(printed).toMatch(/accountingTemplateCount: Int\b/);
		// A document column is not filterable, so no filter names the source or the compiled body.
		expect(inputBody('AccountingTemplateFilter')).not.toMatch(/\b(mjml|hbs):/);
	});
});

describe('AccountingTemplateResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, queryBus } = surfaces();

		const connection = await resolver.accountingTemplates(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same query it dispatches.
		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(AccountingTemplateQuery);
		expect(query.options).toEqual({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ESTIMATE);
	});

	it('orders by the address the lookup resolves a template by when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.accountingTemplates();

		// `estimate` before `invoice`, which is the type the delivered lookup is keyed on.
		expect(connection.nodes.map((node) => node.id)).toEqual([ESTIMATE, INVOICE]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.accountingTemplates({ templateType: { eq: 'invoice' } });
		expect(byType.nodes.map((node) => node.id)).toEqual([INVOICE]);

		const platformCopies = await resolver.accountingTemplates({ tenantId: { isNull: true } });
		expect(platformCopies.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		const byLanguage = await resolver.accountingTemplates({ languageCode: { ilike: 'e%' } });
		expect(byLanguage.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.accountingTemplates(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([INVOICE, ESTIMATE]);

		const byCreated = await resolver.accountingTemplates(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([ESTIMATE, INVOICE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.accountingTemplates(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ESTIMATE]);

		const second = await resolver.accountingTemplates(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([INVOICE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.accountingTemplates(undefined, undefined, undefined, 20);

		const last = await resolver.accountingTemplates(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ESTIMATE]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.accountingTemplates(undefined, [{ field: 'mjml', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.accountingTemplates({ hbs: { eq: '<html/>' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.accountingTemplates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('AccountingTemplateResolver — one concept, two protocols, the same operations', () => {
	it('reads one template through the same service method the REST route calls', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		expect(await resolver.accountingTemplate(INVOICE)).toBe(ROWS[0]);
		expect(accountingTemplateService.findOneByIdString).toHaveBeenCalledWith(INVOICE);
	});

	it('answers null for a template that is not there, rather than the route’s bare 400', async () => {
		const { resolver, accountingTemplateService } = surfaces();
		accountingTemplateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.accountingTemplate(ESTIMATE)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		expect(await resolver.accountingTemplateCount()).toBe(2);
		expect(accountingTemplateService.countBy).toHaveBeenCalledWith({});
	});

	it('resolves the template for a type through the same service method the lookup route calls', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		await resolver.accountingTemplateFor('invoice', 'en', ORGANIZATION);

		// The three members the delivered DTO binds, and the request’s own language beside them, which is
		// the pair the route passes from its `language` header.
		expect(accountingTemplateService.getAccountTemplate).toHaveBeenCalledWith(
			{ templateType: 'invoice', languageCode: 'en', organizationId: ORGANIZATION },
			expect.any(String)
		);
	});

	it('converts a document for preview through the same service method the REST route calls', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		const answer = await resolver.accountingTemplatePreview('<mjml/>', { name: 'Sample' });

		expect(accountingTemplateService.generatePreview).toHaveBeenCalledWith({
			request: { data: '<mjml/>', organization: { name: 'Sample' } }
		});
		expect(answer.html).toContain('<html>');
	});

	it('files a template through the same service method the inherited create route calls', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		await resolver.createAccountingTemplate({
			name: 'receipt',
			languageCode: 'en',
			templateType: AccountingTemplateTypeEnum.RECEIPT,
			mjml: '<mjml/>',
			organizationId: ORGANIZATION
		});

		expect(accountingTemplateService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'receipt',
				templateType: AccountingTemplateTypeEnum.RECEIPT,
				organizationId: ORGANIZATION
			})
		);
	});

	it('changes a template through the same write the REST edit route performs, and reads it back', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		await resolver.updateAccountingTemplate({ id: INVOICE, name: 'Renamed' });

		// The delivered edit is `create` called with the path identifier beside the stated body.
		expect(accountingTemplateService.create).toHaveBeenCalledWith({ name: 'Renamed', id: INVOICE });
		expect(accountingTemplateService.findOneByIdString).toHaveBeenLastCalledWith(INVOICE);
	});

	it('removes a template through the same service method the REST route calls', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		expect(await resolver.deleteAccountingTemplate(INVOICE)).toBe(true);
		expect(accountingTemplateService.delete).toHaveBeenCalledWith(INVOICE);
	});

	it('withdraws and restores a template through the inherited routes’ service methods', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		const withdrawn = await resolver.softDeleteAccountingTemplate(INVOICE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(accountingTemplateService.softRemove).toHaveBeenCalledWith(INVOICE);

		expect(await resolver.recoverAccountingTemplate(INVOICE)).toBe(ROWS[0]);
		expect(accountingTemplateService.softRecover).toHaveBeenCalledWith(INVOICE);
	});

	it('saves a document through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, accountingTemplateService } = surfaces();

		const answer = await resolver.saveAccountingTemplate({
			templateType: AccountingTemplateTypeEnum.INVOICE,
			languageCode: 'en',
			organizationId: ORGANIZATION,
			mjml: '<mjml><body>Invoice</body></mjml>'
		});

		expect(accountingTemplateService.saveTemplate).toHaveBeenCalledWith({
			templateType: AccountingTemplateTypeEnum.INVOICE,
			languageCode: 'en',
			organizationId: ORGANIZATION,
			mjml: '<mjml><body>Invoice</body></mjml>'
		});
		// The service may answer a store result rather than a row, so the row is read back by the same
		// three members the save resolved the copy by.
		expect(accountingTemplateService.findOneByWhereOptions).toHaveBeenCalledWith({
			templateType: AccountingTemplateTypeEnum.INVOICE,
			languageCode: 'en',
			organizationId: ORGANIZATION
		});
		expect(answer).toBe(ROWS[0]);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, accountingTemplateService } = surfaces();
		const refusal = new Error('TEMPLATE_NOT_COMPILABLE: the document could not be compiled.');

		accountingTemplateService.saveTemplate.mockRejectedValueOnce(refusal);

		await expect(
			resolver.saveAccountingTemplate({
				templateType: AccountingTemplateTypeEnum.INVOICE,
				languageCode: 'en',
				organizationId: ORGANIZATION,
				mjml: 'not mjml'
			})
		).rejects.toBe(refusal);
	});
});

describe('AccountingTemplateResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', AccountingTemplateResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', AccountingTemplateController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		// The controller’s own handlers, plus the three the CRUD base declares and this controller
		// inherits: the creation, the withdrawal and the restoration.
		const routes = [
			'getCount',
			'pagination',
			'getAccountingTemplate',
			'generatePreview',
			'saveTemplate',
			'findAll',
			'findById',
			'update',
			'delete',
			'create',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(AccountingTemplateController, handler), FeatureFlagGuard].sort()).toEqual(
				[...Reflect.getMetadata('__guards__', AccountingTemplateResolver)].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, AccountingTemplateResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, AccountingTemplateController)
		);
		expect(permissionOfField('createAccountingTemplate')).toEqual([
			PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['accountingTemplates', 'findAll'],
			['accountingTemplate', 'findById'],
			['accountingTemplateCount', 'getCount'],
			['accountingTemplateFor', 'getAccountingTemplate'],
			['accountingTemplatePreview', 'generatePreview'],
			['createAccountingTemplate', 'create'],
			['updateAccountingTemplate', 'update'],
			['deleteAccountingTemplate', 'delete'],
			['softDeleteAccountingTemplate', 'softRemove'],
			['recoverAccountingTemplate', 'softRecover'],
			['saveAccountingTemplate', 'saveTemplate']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(AccountingTemplateController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the class permission on the fields whose routes are inherited, because those routes do', () => {
		// The CRUD base declares no permission on `create`, `softRemove` or `softRecover`, so each runs
		// under the controller’s class-level one — and so does the field that mirrors it.
		for (const handler of ['create', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(AccountingTemplateController)[handler])).toBeUndefined();
			expect(permissionOfRoute(AccountingTemplateController, handler)).toEqual([
				PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES
			]);
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
		getHandler: () => (AccountingTemplateResolver.prototype as never)[field],
		getClass: () => AccountingTemplateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('AccountingTemplateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, AccountingTemplateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', AccountingTemplateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('accountingTemplates')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('accountingTemplates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('accountingTemplates'))).resolves.toBe(true);
	});
});
