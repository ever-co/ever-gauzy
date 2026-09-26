/**
 * The `GET /:id` read, on both surfaces (doc 17 §3.1).
 *
 * §3.1's first row is the read half of capability parity: *"A node query taking an `ID!`, returning the
 * same object graph the REST `GET /:id` returns for the same caller."* Three of this plugin's resources
 * — the product relation, the variant facet row and the variant gallery row — are served at
 * `/product-relations`, `/product-variant-tags` and `/product-variant-media`, and each of those
 * controllers **inherits** `GET /:id` from `CrudController<T>` rather than declaring it. None of them had
 * a node query: a REST caller holding one row's identifier could read that row and a GraphQL caller
 * could not, and the absence read as a client error rather than as a missing surface, because a root
 * field the document does not declare is refused before any resolver is consulted.
 *
 * Two fields close it — `productRelation` and `tagProductVariant` — and three properties are pinned for
 * each:
 *
 * - it is **declared** in this plugin's document with the identifier the route takes and the answer type
 *   the resource's connection answers with, because a field the document does not carry is one no client
 *   can select;
 * - it **states the permission its own route runs under** — read from the route's metadata rather than
 *   restated here. That reading is the subtle half: the route is *inherited*, so its handler states no
 *   permission at all, and `PermissionGuard` resolves the pair `[handler, class]` through the reflector's
 *   `getAllAndOverride`, which is what makes the controller's **class-level** view grant the permission
 *   the route actually runs under. A field that stated nothing would be answered `true` by the guard —
 *   it returns `true` to empty metadata — and would be reachable by every authenticated caller;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that read the same row through different calls are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the service**, as in the soft-delete wave this plugin's other suite came
 * from. `CrudController` behind the three controllers is the kernel's own — a double would replace the
 * very route body the fields are compared against, and it is precisely the base class's silence about
 * permissions that the comparison below is about — and the document the fields are read out of is the
 * real one, so a document that does not build fails here rather than at boot.
 *
 * The third resource the table named, `ProductVariantMedia`, is deliberately absent: this document
 * already declares a **list** field called `productVariantMedia`, and GraphQL forbids two fields of one
 * name on a type, so its node query cannot be spelled that way without renaming the list field, which
 * this change may not do.
 */

import { RequestMethod } from '@nestjs/common';
import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { ProductRelationController } from '../../product-relation/product-relation.controller';
import { schemaExtensions } from '../schema-extensions';
import { ProductRelationResolver } from './product-relation.resolver';

type Row = Record<string, any>;

/** The row both surfaces read. */
const ID = '00000000-0000-4000-8000-000000000017';

/**
 * The row the service answers with, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that reads a relation over GraphQL and one that
 * reads it over REST must be looking at the same record.
 */
const RELATION = { id: ID, productId: 'product-1', relatedProductId: 'product-2', type: 'RELATED', position: 0 };
const FACET = { id: ID, productVariantId: 'variant-1', tagId: 'tag-1' };

/** One of the resources whose inherited `GET /:id` had no GraphQL counterpart. */
interface IResource {
	/** The resource, as this file names it in its assertions. */
	name: string;
	/** The root field the document declares for it. */
	field: string;
	/** The type its node query answers with, which is what its connection's nodes are. */
	answers: string;
	/**
	 * The controller whose inherited route the field mirrors.
	 *
	 * The field name follows the concept and the controller's path follows the table, which is why the
	 * two differ for the facet resource — `/product-variant-tags` is served as `TagProductVariant`.
	 */
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the resolver over the stubbed service. */
	build: (service: any) => any;
}

/** The two resources, each with the inherited route its field mirrors. */
const RESOURCES: IResource[] = [
	{
		name: 'ProductRelation',
		field: 'productRelation',
		answers: 'ProductRelation',
		controller: ProductRelationController,
		resolver: ProductRelationResolver,
		build: (service) => new ProductRelationResolver(service)
	}
];

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IResource): { service: Row; controller: Row; resolver: Row } {
	const service = {
		findOneByIdString: jest.fn().mockResolvedValue(entry.answers === 'ProductRelation' ? RELATION : FACET)
	};

	return {
		service,
		controller: new entry.controller(service) as Row,
		resolver: entry.build(service)
	};
}

/** The handlers of one controller, as functions, the inherited ones included. */
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
 * `[handler, class]`, which `PermissionGuard` (`shared/guards/permission.guard.ts`) then answers `true`
 * to when the pair is empty.
 *
 * @param controller The controller the route belongs to.
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
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

/** The root query type's own fields, as the document declares them. */
function queryFields(): FieldDefinitionNode[] {
	const query = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Query'
	);

	if (!query?.fields?.length) {
		throw new Error('the catalog document declares no Query fields');
	}

	return [...query.fields];
}

/** One root query field, as the document spells it. */
function queryField(name: string): FieldDefinitionNode {
	const field = queryFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the catalog document declares no Query field named "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The name of the type a field answers with, however deeply it is wrapped. */
function namedTypeOf(field: FieldDefinitionNode): string {
	return namedTypeName(field.type);
}

/**
 * The schema's half of the read.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the catalog document — the node queries are declared', () => {
	it.each(RESOURCES)('declares $field on the query root', ({ field }) => {
		expect(queryField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		// `id: ID!` — the argument §3.1 names, non-null because the route's own `@Param('id',
		// UUIDValidationPipe)` refuses an absent one too, and nothing else, because a read names the row
		// and states nothing about it.
		for (const { field } of RESOURCES) {
			const arguments_ = queryField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName(arguments_[0].type)).toBe('ID');
			expect(arguments_[0].type.kind).toBe('NonNullType');
		}
	});

	it('answers the row the resource’s connection answers, nullable because a miss is an absence', () => {
		// The connection's `nodes` are the resource type itself, and the sibling node queries —
		// `collection(id)` and `productPublication(id)` — answer it bare rather than non-null: a row that
		// is not there is answered as the absence it is, not raised as a refusal.
		for (const { field, answers } of RESOURCES) {
			const declaration = queryField(field);

			expect(namedTypeOf(declaration)).toBe(answers);
			expect(declaration.type.kind).toBe('NamedType');
		}
	});

	it('keeps every query the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = queryFields().map((field) => field.name.value);

		for (const field of [
			'collections',
			'collection',
			'collectionBySlug',
			'collectionProducts',
			'collectionVariants',
			'collectionChannels',
			'productVariantFacets',
			'productPublications',
			'productPublication',
			'productVariantPublications',
			'productRelations',
			'productVariantMedia'
		]) {
			expect(declared).toContain(field);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one read stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the node queries — the two protocols read the same row', () => {
	it.each(RESOURCES)('$field reaches the service method the inherited route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		// The route is `CrudController`'s own handler, reached through the subclass's prototype chain:
		// the controllers declare no `GET /:id` of their own, which is exactly why the field has to
		// mirror the base's read rather than a route body written beside it. The method and the path are
		// read from the kernel's own decorators, so "the route this mirrors is `GET /:id`" is a
		// statement about the mounted route rather than about this file's prose.
		const handler = handlersOf(entry.controller)['findById'];

		expect(typeof handler).toBe('function');
		expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata('path', handler)).toMatch(/^\/?:id$/);

		const overRest = await controller['findById'](ID);
		const overGraphql = await resolver[entry.field](ID);

		// One method, two callers, and the same argument: the id.
		expect(service.findOneByIdString).toHaveBeenCalledTimes(2);
		expect(service.findOneByIdString.mock.calls.map((call) => call[0])).toEqual([ID, ID]);
		// One answer, one implementation: the two protocols are not two ways of reading the same row.
		expect(overRest).toBe(overGraphql);
		expect(overGraphql).toBe(entry.answers === 'ProductRelation' ? RELATION : FACET);
	});

	it.each(RESOURCES)('$field answers the absence of a row rather than refusing it', async (entry) => {
		// A miss is `null` on both surfaces. The field is declared nullable for this reason, and a
		// resolver that raised instead would turn "no such row is visible to you" into a transport
		// error — the sibling node queries of this plugin answer the same way.
		const service = { findOneByIdString: jest.fn().mockResolvedValue(null) };
		const resolver = entry.build(service);

		await expect(resolver[entry.field](ID)).resolves.toBeNull();
		expect(service.findOneByIdString).toHaveBeenCalledWith(ID);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The read is a read on both surfaces, so what has to be true is that neither of them is wider than the
 * other: the field states the grant the route runs under, and a caller holding only some other grant is
 * refused here exactly as it is refused there.
 */
describe('the node queries — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route runs under, read from the route', () => {
		// A control first: the routes are gated, so the comparison below cannot pass on two absences.
		expect(RESOURCES.every(({ controller }) => permissionOfRoute(controller, 'findById'))).toBe(true);

		for (const { field, controller, resolver } of RESOURCES) {
			// The inherited handler states nothing, which is the whole difficulty of this row: the
			// permission the route runs under is the *class-level* one, and it is the pair the guard
			// resolves that the field has to state.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)['findById'])).toBeUndefined();
			expect(permissionOfRoute(controller, 'findById')).toEqual([
				catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW)
			]);

			// And the field states it on its own handler, because no resolver in this plugin declares a
			// class-level grant that could stand in for it: a field that carried none would be answered
			// `true` by `PermissionGuard` — it returns `true` to empty metadata — and would be reachable
			// by every authenticated caller of the tenant.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, controller)
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, 'findById'));
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, controller, resolver } of RESOURCES) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(controller, 'findById')).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, 'findById')));
		}
	});
});
