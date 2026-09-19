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
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { LanguageController } from './language.controller';
import { LanguageResolver } from './language.resolver';

/**
 * The platform's language master over GraphQL.
 *
 * The delivered `/api/languages` routes serve two reads and nothing else: the list, and a read by
 * name. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - the list is a connection with the platform's own cursor codec behind it, and the read by name is
 *   a filter of it rather than a second root field;
 * - **there is no mutation**, because no route of this controller writes;
 * - the guard chain is the controller's — which is none — and the surface states the one thing it
 *   cannot reproduce: the two routes are `@Public()` and the field is not, because a marked field
 *   would be refused to every caller by the gate over it.
 */

const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		name: 'English',
		code: 'en',
		is_system: true,
		description: 'English',
		color: '#1D4ED8',
		isActive: true,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		name: 'German',
		code: 'de',
		is_system: true,
		description: null,
		color: '#111827',
		isActive: true,
		createdAt: new Date('2026-01-02T10:00:00.000Z'),
		updatedAt: new Date('2026-01-02T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const languageService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByName: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { languageService, resolver: new LanguageResolver(languageService as never) };
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

/** The root fields this domain contributes, which are the ones whose name begins with its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.startsWith('language'))
		.sort();
}

/** The printed body of one type, object or input. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof LanguageController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof LanguageController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof LanguageController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = LanguageResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('LanguageResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query and nothing else', () => {
		expect(rootFields('Query')).toContain('languages');
		// The read by name joins nothing the list read does not, so it is a filter rather than a second
		// root field that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['languages']);
	});

	it('declares no mutation, because no route of this controller writes', () => {
		// The organization-language domain beside this one serves a write of its own; the language master
		// itself serves none, and this surface invents none for it.
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type LanguageConnection \{\s*nodes: \[Language!\]!\s*edges: \[LanguageEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type LanguageEdge \{\s*node: Language!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input LanguageFilter \{/);
		expect(printed).toMatch(/enum LanguageSortField \{\s*createdAt\s*updatedAt\s*name\s*code\s*\}/);
	});

	it('carries the row’s own columns and spells the seeded flag as the column is', () => {
		const language = body('Language', 'type');

		expect(language).toMatch(/name: String\b/);
		expect(language).toMatch(/code: String\b/);
		expect(language).toMatch(/isActive: Boolean\b/);
		// The default field resolver reads the row's own property, which is `is_system`: a camelCase
		// member would answer null on every row, silently.
		expect(language).toMatch(/is_system: Boolean\b/);
		expect(language).not.toContain('isSystem');
		expect(language).not.toContain('isArchived');
	});

	it('offers no argument it cannot honour and no member it cannot write', () => {
		expect(printed).not.toMatch(/languageCount/);
		// The table carries no tenancy column, so there is nothing for a tenant member to state.
		expect(body('Language', 'type')).not.toContain('tenantId');
		expect(body('LanguageFilter', 'input')).not.toContain('organizationId');
	});
});

describe('LanguageResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, languageService } = surfaces();

		const connection = await resolver.languages(undefined, undefined, undefined, 20);

		expect(languageService.findAll).toHaveBeenCalledWith();
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		// The vocabulary's own order is by name, so English leads the page.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders by the vocabulary’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.languages()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, including the seeded flag', async () => {
		const { resolver } = surfaces();

		expect((await resolver.languages({ code: { eq: 'de' } })).nodes.map((node) => node.id)).toEqual([SECOND]);
		expect((await resolver.languages({ name: { eq: 'English' } })).nodes.map((node) => node.id)).toEqual([FIRST]);
		expect((await resolver.languages({ is_system: { eq: false } })).totalCount).toBe(0);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.languages(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.languages(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.languages(undefined, [{ field: 'is_system', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.languages({ tenantId: { eq: FIRST } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('LanguageResolver — the guard chain and the openness are the controller’s', () => {
	it('states no guard the controller does not state', () => {
		// The controller declares no guard at all: this is public reference data, and both of its
		// handlers say so.
		expect(Reflect.getMetadata('__guards__', LanguageController)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', LanguageResolver)).toEqual([FeatureFlagGuard]);
		expect(Reflect.getMetadata('__guards__', LanguageResolver)).not.toContain(TenantPermissionGuard);
		expect(Reflect.getMetadata('__guards__', LanguageResolver)).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', LanguageResolver) ?? [];

		for (const handler of ['findAll', 'findByName']) {
			expect([...guardsOfRoute(LanguageController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('carries the marker neither endpoint does, and states why rather than shipping a dead field', () => {
		// Both delivered routes are `@Public()`. The global authentication guard returns on that marker
		// before it authenticates, so a marked field would run with no user on the request — and the
		// capability gate, which resolves from that context, would then refuse the field to every caller.
		for (const handler of ['findAll', 'findByName']) {
			expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(LanguageController)[handler])).toBe(true);
		}

		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, LanguageResolver.prototype.languages)).toBeUndefined();
	});

	it('states no permission on the class or on the field, because no route has one', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, LanguageController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, LanguageResolver)).toBeUndefined();
		expect(permissionOfField('languages')).toBeUndefined();
		expect(permissionOfRoute(LanguageController, 'findAll')).toBeUndefined();
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
		getHandler: () => (LanguageResolver.prototype as never)[field],
		getClass: () => LanguageResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('LanguageResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, LanguageResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', LanguageResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('languages')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('languages');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('languages'))).resolves.toBe(true);
	});
});
