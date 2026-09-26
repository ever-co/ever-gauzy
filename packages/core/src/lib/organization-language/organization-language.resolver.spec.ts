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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationLanguageController } from './organization-language.controller';
import { OrganizationLanguageResolver } from './organization-language.resolver';

/**
 * The organization language over GraphQL.
 *
 * The delivered REST routes serve a language list, one row, a count, a filing, an edit, a removal, and
 * the withdrawal and restoration of a row — four declared by the controller and five inherited from
 * the CRUD base. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain is the controller's and no field states a permission**, because the delivered
 *   controller states none anywhere;
 * - the reference relation is carried as its join column rather than as a field that would answer null;
 * - a row that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		languageCode: 'fr',
		name: 'French',
		level: 'Professional',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		languageCode: 'en',
		name: 'English',
		level: 'Native',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const organizationLanguageService = {
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
		organizationLanguageService,
		resolver: new OrganizationLanguageResolver(organizationLanguageService as never)
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The concept's name begins with the organization's own, so the match is anchored at both ends rather
 * than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationLanguage(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)OrganizationLanguage$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationLanguageController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationLanguageController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationLanguageController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationLanguageResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationLanguageResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationLanguages',
				'organizationLanguage',
				'organizationLanguageCount'
			])
		);
	});

	it('declares one mutation per delivered write route, inherited ones included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationLanguage',
				'updateOrganizationLanguage',
				'deleteOrganizationLanguage',
				'softDeleteOrganizationLanguage',
				'recoverOrganizationLanguage'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'organizationLanguage',
			'organizationLanguageCount',
			'organizationLanguages'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationLanguage',
			'deleteOrganizationLanguage',
			'recoverOrganizationLanguage',
			'softDeleteOrganizationLanguage',
			'updateOrganizationLanguage'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationLanguageConnection \{\s*nodes: \[OrganizationLanguage!\]!\s*edges: \[OrganizationLanguageEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationLanguageEdge \{\s*node: OrganizationLanguage!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationLanguageFilter \{/);
		expect(printed).toMatch(/input OrganizationLanguageSort \{/);
		expect(printed).toMatch(
			/enum OrganizationLanguageSortField \{\s*createdAt\s*updatedAt\s*name\s*languageCode\s*level\s*\}/
		);
	});

	it('carries the join column rather than a relation the read does not join', () => {
		const body = typeBody('OrganizationLanguage');

		expect(body).toMatch(/languageCode: String!/);
		expect(body).toMatch(/name: String!/);
		// The proficiency band is the organization's own wording, so it is carried as its value rather
		// than closed into an enum this domain would have to own.
		expect(body).toMatch(/level: String!/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/deletedAt: DateTime/);
		// The reference row is joined only when a REST caller names the relation; this surface names
		// none, so a `language` member here would always answer null.
		expect(body).not.toMatch(/\blanguage: Language\b/);
		expect(body).not.toMatch(/organization: Organization\b/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/organizationLanguages\([^)]*withDeleted/);
		expect(printed).not.toMatch(/organizationLanguageCount\(/);
	});

	it('declares no filter on the reference relation', () => {
		const filter = printed.match(/input OrganizationLanguageFilter \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(filter).not.toMatch(/\blanguage: /);
		// The join column is the filter a caller who knows the language actually states.
		expect(filter).toMatch(/languageCode: StringFilter/);
	});
});

describe('OrganizationLanguageResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		const connection = await resolver.organizationLanguages(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its `data` parameter states nothing.
		expect(organizationLanguageService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationLanguages();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.organizationLanguages({ languageCode: { eq: 'en' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byLevel = await resolver.organizationLanguages({ level: { ilike: 'prof%' } });
		expect(byLevel.nodes.map((node) => node.id)).toEqual([SECOND]);

		const refusal = await resolver
			.organizationLanguages({ language: { eq: FIRST } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.organizationLanguages(undefined, [
			{ field: 'languageCode', direction: 'ASC' }
		]);
		expect(byCode.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byLevel = await resolver.organizationLanguages(undefined, [{ field: 'level', direction: 'ASC' }]);
		expect(byLevel.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationLanguages(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.organizationLanguages(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationLanguages(undefined, undefined, undefined, 20);

		const last = await resolver.organizationLanguages(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationLanguages(undefined, [{ field: 'language', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationLanguages(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationLanguageResolver — one concept, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST route calls', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		expect(await resolver.organizationLanguage(SECOND)).toBe(ROWS[0]);
		expect(organizationLanguageService.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationLanguageService } = surfaces();
		organizationLanguageService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationLanguage(FIRST)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		expect(await resolver.organizationLanguageCount()).toBe(2);
		expect(organizationLanguageService.countBy).toHaveBeenCalledWith();
	});

	it('files a row through the same service method the REST route calls', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		await resolver.createOrganizationLanguage({
			organizationId: ORGANIZATION,
			languageCode: 'fr',
			name: 'French',
			level: 'Professional'
		});

		expect(organizationLanguageService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			languageCode: 'fr',
			name: 'French',
			level: 'Professional'
		});
	});

	it('edits a row through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		const updated = await resolver.updateOrganizationLanguage({ id: SECOND, level: 'Fluent' });

		expect(organizationLanguageService.update).toHaveBeenCalledWith(SECOND, { level: 'Fluent' });
		// The store's update result is a statement about the write rather than a row, so the answer is
		// read back through the same service.
		expect(organizationLanguageService.findOneByIdString).toHaveBeenCalledWith(SECOND);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a row through the same service method the REST route calls', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		expect(await resolver.deleteOrganizationLanguage(SECOND)).toBe(true);
		expect(organizationLanguageService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores a row through the same service methods the REST routes call', async () => {
		const { resolver, organizationLanguageService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationLanguage(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationLanguageService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverOrganizationLanguage(SECOND)).toBe(ROWS[0]);
		expect(organizationLanguageService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationLanguageService } = surfaces();
		const refusal = new Error('ORGANIZATION_LANGUAGE_ALREADY_FILED: this language is already in the register.');

		organizationLanguageService.create.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createOrganizationLanguage({
				organizationId: ORGANIZATION,
				languageCode: 'fr',
				name: 'French',
				level: 'Professional'
			})
		).rejects.toBe(refusal);
	});
});

describe('OrganizationLanguageResolver — the guard stack is the controller’s, and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationLanguageResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationLanguageController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, FeatureFlagGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).not.toContain(PermissionGuard);
		expect(controllerGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationLanguageResolver) ?? [];
		const routes = ['findAll', 'findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover'];

		for (const handler of routes) {
			expect([...guardsOfRoute(OrganizationLanguageController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationLanguageController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationLanguageResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationLanguages', 'findAll'],
			['organizationLanguage', 'findById'],
			['organizationLanguageCount', 'getCount'],
			['createOrganizationLanguage', 'create'],
			['updateOrganizationLanguage', 'update'],
			['deleteOrganizationLanguage', 'delete'],
			['softDeleteOrganizationLanguage', 'softRemove'],
			['recoverOrganizationLanguage', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationLanguageController, handler)])
		);

		expect(stated).toEqual(expected);
		for (const [, permission] of Object.entries(stated)) {
			expect(permission).toBeUndefined();
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
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
		getHandler: () => (OrganizationLanguageResolver.prototype as never)[field],
		getClass: () => OrganizationLanguageResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationLanguageResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationLanguageResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationLanguageResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationLanguages')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationLanguages');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationLanguages'))).resolves.toBe(true);
	});
});
