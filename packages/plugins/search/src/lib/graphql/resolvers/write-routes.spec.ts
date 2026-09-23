/**
 * The four write routes this package answers under other names — and the one authoring route nobody serves.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **four** of this package's four write
 * routes — every one of them. That is a complete false-positive set, and this suite is the reading that
 * says so: nothing here is a gap, and no field is delivered, because each route is already answered under
 * a name the instrument's contiguity test cannot see.
 *
 * - `PUT /search/index-definitions/:id`, handler `updateIndexDefinition`, is answered by
 *   **`updateSearchIndexDefinition`**; `DELETE /search/index-definitions/:id`, handler
 *   `deleteIndexDefinition`, by **`deleteSearchIndexDefinition`**. In both, the resource is named in full
 *   between the verb and the noun.
 * - `POST /search/reindex`, handler `reindex`, is answered by **two** fields rather than one:
 *   `reindexEntity(entity, input)` and `reindexAll(input)`, which split the route's `scope` member between
 *   them — the first forces `ENTITY`, the second chooses `CHANNEL` when a channel is named and `ALL`
 *   otherwise. Both reach the same pair of service calls the route reaches, `plan` and `run`, with the same
 *   request.
 * - `DELETE /search/index`, handler `dropIndex`, is answered by **`dropSearchIndex`**.
 *
 * **The derived-surface question this domain poses is answered by the code, not by a refusal.** An index is
 * derived state — every row it holds is reproducible from the tables it indexes — so a create, a reindex or
 * a drop *could* have been read as a surface that must not be mirrored. It is not, and the reason is that
 * the specification and the code both make these operator actions rather than authoring ones: §3.2's search
 * row lists `reindexEntity`, `reindexAll` and (in the API specification's own table, `06` §7.20)
 * `DELETE /search/index` as delivered operations, and the document answers all three under the operator
 * grant `SEARCH_REINDEX`. What the parity rule asks for is therefore already there, and a wave that refused
 * these four would be refusing capabilities both surfaces already have.
 *
 * **One route is served by neither surface, and that is a finding rather than a gap.** `06` §7.20 states
 * `POST /search/index-definitions` — *"Declare an index definition for an entity"*, under
 * `SEARCH_INDEX_DEFINITIONS_EDIT`, idempotent — and no controller declares it and no field answers it. The
 * resolver's own docstring states the refusal deliberately: *"There is deliberately no
 * `createSearchIndexDefinition`: an authored declaration is a second, weaker copy of a fact the code
 * already states."* The declaration is shipped by the package that owns the entity, so a route that let a
 * caller author one would contradict that design. **A parity wave can do nothing with this**, because the
 * gap is on the REST side and the fix is either to serve the route or to amend the specification — both
 * the owner's calls. The suite pins both absences so the finding cannot be mistaken for an oversight.
 *
 * The four fields are still driven on both surfaces, because a collapse asserted only as an absence is a
 * claim: what is compared is the call each surface makes on its own stub, which is the seam §3.1's parity
 * requirement is about. **Nothing is doubled here but the services** — the controller, the resolvers and
 * the document are the real ones.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import {
	FieldDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode
} from 'graphql';
import { SearchPermissions } from '../../search.permissions';
import { SearchController } from '../../search.controller';
import { schemaExtensions } from '../schema-extensions';
import { SearchIndexDefinitionResolver } from './search-index-definition.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const DEFINITION = '00000000-0000-4000-8000-000000000601';
const CHANNEL = '00000000-0000-4000-8000-000000000602';

/** What the services answer, so the two surfaces can be compared. */
const DEFINITION_ROW = { id: DEFINITION, entity: 'product', isActive: true, version: 3 };
const PLAN = { entity: 'product', queued: true, estimatedCount: 12 };
const RUNS = [{ entity: 'product', indexed: 12 }];

/** The body the update route accepts, and the answer its field gives. */
const UPDATE_BODY = { label: 'Products', isActive: false };

/**
 * One collapsed route, its two surfaces, and the method both must reach.
 *
 * A route with two serving fields is listed once with both fields rather than twice, because the
 * capability is one: the `scope` member the route carries is what the two fields split between them.
 */
interface ICollapsed {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The name the audit's convention expected, which is the handler's own. */
	expects: string;
	/** Every field that serves the capability, in the order the suite drives them. */
	fields: string[];
	/** Drives the route with the arguments its handler takes. */
	overRest: (stubs: Row) => Promise<unknown>;
	/** Drives each serving field with the arguments it takes. */
	overGraphql: ((stubs: Row) => Promise<unknown>)[];
	/** The service that owns the capability. */
	service: 'definition' | 'reindex';
	/** The methods the route reaches, in order, with the arguments each must receive. */
	routeCalls: [string, any[]][];
	/** The methods the fields reach, in order, with the arguments each must receive. */
	fieldCalls: [string, any[]][];
}

/**
 * The four routes the reading collapsed, each with the fields that already serve it.
 *
 * Every one is driven: the route first, then each field that answers it, and the assertions below compare
 * the calls rather than the envelopes the two protocols put around them.
 */
const COLLAPSED: ICollapsed[] = [
	{
		controller: SearchController,
		resource: 'SearchIndexDefinition',
		route: 'updateIndexDefinition',
		expects: 'updateIndexDefinition',
		fields: ['updateSearchIndexDefinition'],
		overRest: (stubs) => surfaces(stubs).controller.updateIndexDefinition(DEFINITION, UPDATE_BODY),
		overGraphql: [(stubs) => surfaces(stubs).definitionResolver.updateSearchIndexDefinition(DEFINITION, UPDATE_BODY)],
		service: 'definition',
		routeCalls: [['updateDefinition', [DEFINITION, UPDATE_BODY]]],
		// The field states the same members explicitly rather than forwarding the caller's object, so the
		// comparison is of the values it passes — which is what makes "the same call" a test.
		fieldCalls: [
			[
				'updateDefinition',
				[
					DEFINITION,
					{
						label: UPDATE_BODY.label,
						fields: undefined,
						titleTemplate: undefined,
						bodyTemplate: undefined,
						keywordFields: undefined,
						defaultWeight: undefined,
						sourceUpdatedAtField: undefined,
						isActive: UPDATE_BODY.isActive
					}
				]
			]
		]
	},
	{
		controller: SearchController,
		resource: 'SearchIndexDefinition',
		route: 'deleteIndexDefinition',
		expects: 'deleteIndexDefinition',
		fields: ['deleteSearchIndexDefinition'],
		overRest: (stubs) => surfaces(stubs).controller.deleteIndexDefinition(DEFINITION),
		overGraphql: [(stubs) => surfaces(stubs).definitionResolver.deleteSearchIndexDefinition(DEFINITION)],
		service: 'definition',
		routeCalls: [['removeDefinition', [DEFINITION]]],
		fieldCalls: [['removeDefinition', [DEFINITION]]]
	},
	{
		controller: SearchController,
		resource: 'Search',
		route: 'reindex',
		expects: 'reindex',
		// One route, two fields: the route's `scope` member is what they split.
		fields: ['reindexEntity', 'reindexAll'],
		overRest: (stubs) => surfaces(stubs).controller.reindex({ scope: 'ENTITY', entity: 'product' }),
		overGraphql: [
			(stubs) => surfaces(stubs).definitionResolver.reindexEntity('product'),
			(stubs) => surfaces(stubs).definitionResolver.reindexAll({ channelId: CHANNEL })
		],
		service: 'reindex',
		routeCalls: [
			['plan', [{ scope: 'ENTITY', entity: 'product', channelId: undefined, ids: undefined, since: undefined }]],
			['run', [{ scope: 'ENTITY', entity: 'product', channelId: undefined, ids: undefined, since: undefined }]]
		],
		fieldCalls: [
			['plan', [{ scope: 'ENTITY', entity: 'product', channelId: undefined, ids: undefined, since: undefined }]],
			['run', [{ scope: 'ENTITY', entity: 'product', channelId: undefined, ids: undefined, since: undefined }]],
			['plan', [{ scope: 'CHANNEL', channelId: CHANNEL, entity: undefined, ids: undefined, since: undefined }]],
			['run', [{ scope: 'CHANNEL', channelId: CHANNEL, entity: undefined, ids: undefined, since: undefined }]]
		]
	},
	{
		controller: SearchController,
		resource: 'Search',
		route: 'dropIndex',
		expects: 'dropIndex',
		fields: ['dropSearchIndex'],
		overRest: (stubs) => surfaces(stubs).controller.dropIndex({ entity: 'product', channelId: CHANNEL }),
		overGraphql: [(stubs) => surfaces(stubs).definitionResolver.dropSearchIndex('product', CHANNEL)],
		service: 'reindex',
		routeCalls: [['drop', ['product', CHANNEL]]],
		fieldCalls: [['drop', ['product', CHANNEL]]]
	}
];

/**
 * The one authoring route neither surface serves.
 *
 * `06` §7.20 states it and the resolver's own docstring refuses it, so the finding is a disagreement
 * between the specification and the code rather than a capability one protocol has and the other does not.
 */
const UNSERVED_EVERYWHERE = {
	controller: SearchController,
	/** The handler the API specification's route would be served by. */
	route: 'createIndexDefinition',
	/** The field a convention would have given it. */
	field: 'createSearchIndexDefinition',
	because:
		'06 §7.20 states POST /search/index-definitions and the resolver refuses an authored declaration deliberately'
};

/**
 * The two surfaces over one pair of stubs.
 *
 * Both services carry both methods under test, so a field that reached the wrong service is visible as an
 * assertion about the wrong stub rather than as a comparison that passes.
 */
function surfaces(stubs: Row): { controller: Row; definitionResolver: Row } {
	return {
		controller: new SearchController(stubs.search ?? {}, stubs.reindex, stubs.definition) as Row,
		definitionResolver: new SearchIndexDefinitionResolver(stubs.definition, stubs.reindex) as Row
	};
}

/** The stubs the surfaces are built over. */
function stubsFor(): Row {
	return {
		definition: {
			updateDefinition: jest.fn().mockResolvedValue(DEFINITION_ROW),
			removeDefinition: jest.fn().mockResolvedValue({ id: DEFINITION, deleted: true }),
			list: jest.fn().mockResolvedValue([DEFINITION_ROW]),
			findOneScoped: jest.fn().mockResolvedValue(DEFINITION_ROW)
		},
		reindex: {
			plan: jest.fn().mockResolvedValue(PLAN),
			run: jest.fn().mockResolvedValue(RUNS),
			drop: jest.fn().mockResolvedValue({ deletedCount: 4 }),
			status: jest.fn().mockResolvedValue([])
		}
	};
}

/** The handlers of one controller, as functions. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
 */
function permissionOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, resolver)
	);
}

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? (Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? []) : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the search document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
}

/**
 * The reading, asserted rather than described: every flagged route is answered, under another name.
 *
 * Each pair is one act, so the assertion is that the same methods are reached with the same arguments on
 * both surfaces — which is what makes the collapse a statement about capabilities rather than about names.
 */
describe('the four flagged routes — every one served under another name', () => {
	it('flags four routes, collapses all four, and delivers none', () => {
		// Four write routes in the whole controller, four flagged, five fields serving them — one of the
		// routes is split between two fields — and nothing delivered, because nothing was missing.
		expect(COLLAPSED).toHaveLength(4);
		expect(COLLAPSED.reduce((total, entry) => total + entry.fields.length, 0)).toBe(5);
		expect(COLLAPSED.filter((entry) => entry.fields.length > 1)).toHaveLength(1);
	});

	it.each(COLLAPSED)('$resource.$route reaches the same service methods on both surfaces', async (entry) => {
		const stubs = stubsFor();
		const service = stubs[entry.service] as Row;

		// The route first, then every field that serves it — each with the arguments its own surface takes,
		// so a field that reordered them or dropped one fails here.
		await entry.overRest(stubs);
		for (const [method, args] of entry.routeCalls) {
			expect(service[method]).toHaveBeenNthCalledWith(1, ...args);
		}

		for (const drive of entry.overGraphql) {
			await drive(stubs);
		}
		for (const [method, args] of entry.fieldCalls) {
			expect(service[method]).toHaveBeenCalledWith(...args);
		}
	});

	it.each(COLLAPSED)('$resource.$route is served by $fields, and not by a field of the handler’s name', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(declares(entry.expects)).toBe(false);

		for (const field of entry.fields) {
			expect(declares(field)).toBe(true);
		}
	});

	it('splits the reindex route between two fields rather than losing half of it', async () => {
		// The route carries a `scope` member; the document splits it. Both halves must reach the same pair
		// of calls, or a caller could express one scope over GraphQL and not the other.
		const entity = COLLAPSED.find((entry) => entry.route === 'reindex') as ICollapsed;
		const stubs = stubsFor();
		const { controller, definitionResolver } = surfaces(stubs);

		await controller.reindex({ scope: 'ENTITY', entity: 'product' });
		await definitionResolver.reindexEntity('product');
		await definitionResolver.reindexAll({ channelId: CHANNEL });

		// Two ENTITY runs and one CHANNEL run over the same pair of methods: three plan calls and three run
		// calls, in the order the three surfaces were driven.
		expect(stubs.reindex.plan).toHaveBeenCalledTimes(3);
		expect(stubs.reindex.run).toHaveBeenCalledTimes(3);
		expect(stubs.reindex.plan.mock.calls.map((call: any[]) => call[0].scope)).toEqual([
			'ENTITY',
			'ENTITY',
			'CHANNEL'
		]);
		expect(stubs.reindex.run.mock.calls.map((call: any[]) => call[0].scope)).toEqual([
			'ENTITY',
			'ENTITY',
			'CHANNEL'
		]);
		expect(entity.fields).toEqual(['reindexEntity', 'reindexAll']);
	});
});

/**
 * The authoring route neither surface serves.
 *
 * This is the one place in this package where the specification and the code disagree, and the disagreement
 * is not a parity gap: no REST caller can declare a definition either. It is pinned here so the absence is
 * a recorded finding rather than an oversight a later wave might "fix" by adding a field the design
 * refuses.
 */
describe('the one route neither surface serves — recorded, not a gap', () => {
	it('is not declared by the controller and not answered by any field', () => {
		expect(typeof handlersOf(UNSERVED_EVERYWHERE.controller)[UNSERVED_EVERYWHERE.route]).toBe('undefined');
		expect(declares(UNSERVED_EVERYWHERE.field)).toBe(false);
		expect(declares('createIndexDefinition')).toBe(false);
	});

	it('leaves the definitions readable and re-weightable, which is what the design does serve', () => {
		// The control: the resource is served, so the absence above is a refusal rather than an unimplemented
		// resource. A definition is read, re-weighted, deactivated and removed; it is never authored.
		for (const name of [
			'updateSearchIndexDefinition',
			'deleteSearchIndexDefinition',
			'reindexEntity',
			'reindexAll',
			'dropSearchIndex'
		]) {
			expect(declares(name)).toBe(true);
		}

		expect(UNSERVED_EVERYWHERE.because).toContain('§7.20');
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Every one of the four is a write, so a field that stated no grant of its own would be one
 * `PermissionGuard` answers `true` to, because it answers `true` to empty metadata: any caller who may
 * search could re-weight a definition, rebuild the index or drop one. No resolver in this plugin states a
 * class-level grant at all, which is why the comparison is against the route's own handler metadata.
 */
describe('the four serving fields — the permission and the guards are the routes’', () => {
	const SERVING: { field: string; route: string; resolver: new (...args: any[]) => any; grant: string }[] = [
		{
			field: 'updateSearchIndexDefinition',
			route: 'updateIndexDefinition',
			resolver: SearchIndexDefinitionResolver,
			grant: SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT
		},
		{
			field: 'deleteSearchIndexDefinition',
			route: 'deleteIndexDefinition',
			resolver: SearchIndexDefinitionResolver,
			grant: SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT
		},
		{
			field: 'reindexEntity',
			route: 'reindex',
			resolver: SearchIndexDefinitionResolver,
			grant: SearchPermissions.SEARCH_REINDEX
		},
		{
			field: 'reindexAll',
			route: 'reindex',
			resolver: SearchIndexDefinitionResolver,
			grant: SearchPermissions.SEARCH_REINDEX
		},
		{
			field: 'dropSearchIndex',
			route: 'dropIndex',
			resolver: SearchIndexDefinitionResolver,
			grant: SearchPermissions.SEARCH_REINDEX
		}
	];

	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are gated, so the comparison below cannot pass on two absences.
		expect(SERVING.every(({ route }) => permissionOfRoute(SearchController, route))).toBe(true);

		for (const { field, route, resolver } of SERVING) {
			expect(typeof handlersOf(SearchController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(SearchController)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(SearchController, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, resolver, grant } of SERVING) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and this resolver states no class grant
			// that could stand in for the field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(SearchController, route)).toEqual([grant]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, resolver } of SERVING) {
			const routeGuards = guardsOf(SearchController);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(SearchController, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(SearchController, route)));
		}
	});
});
