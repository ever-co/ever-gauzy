/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all nine of
 * this plugin's CRUD controllers serve that pair while not one of its eight resolvers declared either
 * field. A client could therefore retire a collection, a membership, a publication, a relation, a gallery
 * row or a facet recoverably over REST and not over GraphQL, where the only deletion-shaped field it held
 * was the destructive one — and the destructive one is exactly what the soft routes exist to avoid on rows
 * a storefront, an order or a curation list may still name. Eighteen fields close that, and three
 * properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here, so
 *   a caller that holds the class-level reading grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the service**, as in the pricing and tax waves this pair was delivered
 * from. The nine controllers are the real ones — including the `softRemove` and `softRecover` overrides,
 * which exist only to state the permission the inherited routes leave unstated — the eight resolvers are
 * the real ones, `CrudController` behind them is the kernel's own, and the document the fields are read
 * out of is the real one. That is a deliberate departure from this package's other suites, which double
 * `@gauzy/core` at the module boundary to avoid booting the application graph: a double here would replace
 * the very route bodies the fields are compared against, and the permission metadata this suite reads is
 * written by the kernel's own `@Permissions` decorator. The cost is that this one suite loads the barrel
 * the rest of the package mocks; the service is the seam the parity requirement is about, and one stub is
 * what makes "the same method with the same identifier" visible without a database behind it.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionController } from '../../collection/collection.controller';
import { CollectionChannelController } from '../../collection-channel/collection-channel.controller';
import { CollectionProductController } from '../../collection-product/collection-product.controller';
import { CollectionVariantController } from '../../collection-variant/collection-variant.controller';
import { ProductChannelController } from '../../product-channel/product-channel.controller';
import { ProductRelationController } from '../../product-relation/product-relation.controller';
import { ProductVariantChannelController } from '../../product-variant-channel/product-variant-channel.controller';
import { ProductVariantMediaController } from '../../product-variant-media/product-variant-media.controller';
import { TagProductVariantController } from '../../tag-product-variant/tag-product-variant.controller';
import { schemaExtensions } from '../schema-extensions';
import { CollectionResolver } from './collection.resolver';
import { CollectionChannelResolver } from './collection-channel.resolver';
import { CollectionProductResolver } from './collection-product.resolver';
import { CollectionVariantResolver } from './collection-variant.resolver';
import { ProductPublicationResolver } from './product-publication.resolver';
import { ProductRelationResolver } from './product-relation.resolver';
import { ProductVariantMediaResolver } from './product-variant-media.resolver';
import { TagProductVariantResolver } from './tag-product-variant.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000017';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a membership over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the nine resources, its two surfaces and what its fields answer with. */
interface IResource {
	/** The resource as the controller names it, which is what the root fields are built from. */
	name: string;
	/**
	 * The type its fields answer with: the row, which is what the resource's other mutations answer too.
	 *
	 * Two of these tables carry a name that differs from their resource on purpose — `product_channel` is
	 * served as `ProductPublication` and `product_variant_channel` as `ProductVariantPublication` — so the
	 * field names follow the controller and the answer type follows the document.
	 */
	answers: string;
	/** The grant its own routes state, which is what the fields must state. */
	grant: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/**
	 * Builds the resolver over the stubbed service.
	 *
	 * The parameter and the answer are deliberately untyped: the stub is not a service — that is the point
	 * of it — and the constructor's collaborators other than the service (the collection resolver's event
	 * bus, the publication resolver's second service) are named here rather than injected, so each resource
	 * can state the one it actually takes.
	 */
	build: (service: any) => any;
}

/** The nine resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'Collection',
		answers: 'Collection',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE),
		controller: CollectionController,
		resolver: CollectionResolver,
		build: (service) => new CollectionResolver(service, { ofType: () => null } as never)
	},
	{
		name: 'CollectionChannel',
		answers: 'CollectionChannel',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE),
		controller: CollectionChannelController,
		resolver: CollectionChannelResolver,
		build: (service) => new CollectionChannelResolver(service)
	},
	{
		name: 'CollectionProduct',
		answers: 'CollectionProduct',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT),
		controller: CollectionProductController,
		resolver: CollectionProductResolver,
		build: (service) => new CollectionProductResolver(service)
	},
	{
		name: 'CollectionVariant',
		answers: 'CollectionVariant',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE),
		controller: CollectionVariantController,
		resolver: CollectionVariantResolver,
		build: (service) => new CollectionVariantResolver(service)
	},
	{
		name: 'ProductChannel',
		answers: 'ProductPublication',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE),
		controller: ProductChannelController,
		resolver: ProductPublicationResolver,
		build: (service) => new ProductPublicationResolver(service, service, { ofType: () => null } as never)
	},
	{
		name: 'ProductRelation',
		answers: 'ProductRelation',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT),
		controller: ProductRelationController,
		resolver: ProductRelationResolver,
		build: (service) => new ProductRelationResolver(service)
	},
	{
		name: 'ProductVariantChannel',
		answers: 'ProductVariantPublication',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE),
		controller: ProductVariantChannelController,
		resolver: ProductPublicationResolver,
		build: (service) => new ProductPublicationResolver(service, service, { ofType: () => null } as never)
	},
	{
		name: 'ProductVariantMedia',
		answers: 'ProductVariantMedia',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE),
		controller: ProductVariantMediaController,
		resolver: ProductVariantMediaResolver,
		build: (service) => new ProductVariantMediaResolver(service)
	},
	{
		name: 'TagProductVariant',
		answers: 'TagProductVariant',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE),
		controller: TagProductVariantController,
		resolver: TagProductVariantResolver,
		build: (service) => new TagProductVariantResolver(service)
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The eighteen fields, built from the nine resources so a resource cannot be listed with only half a pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this kind
 * already use.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{ ...resource, field: `softDelete${resource.name}`, route: 'softRemove', method: 'softRemove' },
	{ ...resource, field: `recover${resource.name}`, route: 'softRecover', method: 'softRecover' }
]);

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * The destructive removals are stubbed as well, so a field that took the hard path instead of the
 * recoverable one fails here rather than in production.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const service = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softDelete: jest.fn().mockResolvedValue(RETIRED)
	};

	return {
		service,
		controller: new entry.controller(service) as Row,
		resolver: entry.build(service)
	};
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
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

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the catalog document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the catalog document declares no Mutation field named "${name}"`);
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
 * The schema's half of the pair.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the catalog document — the nine inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		// `id: ID!` and not the update field's whole input: a lifecycle move names the row and states
		// nothing about it, so an input object here would invite a caller to send edits that this
		// capability does not make.
		for (const { field } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName(arguments_[0].type)).toBe('ID');
			expect(arguments_[0].type.kind).toBe('NonNullType');
		}
	});

	it('answers the row each route answers, which is what the resource’s other mutations answer', () => {
		// The REST routes answer the row they retired or restored, and so does every single-row mutation
		// this plugin already declared — `createCollection` returns the collection — so the pair follows
		// that, not a second shape invented for it. The two publication resources answer the publication
		// types their own queries answer, because that is what those tables are served as.
		for (const { field, answers } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createCollection',
			'updateCollection',
			'deleteCollection',
			'addCollectionProducts',
			'removeCollectionProducts',
			'addCollectionVariants',
			'removeCollectionVariants',
			'attachProductVariantFacets',
			'detachProductVariantFacets',
			'assignCollectionChannel',
			'unassignCollectionChannel',
			'publishProduct',
			'unpublishProduct',
			'publishProductVariant',
			'unpublishProductVariant',
			'createProductRelation',
			'updateProductRelation',
			'deleteProductRelation',
			'attachProductVariantMedia',
			'reorderProductVariantMedia',
			'detachProductVariantMedia'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is being corrected. A second spelling is a second vocabulary for one capability, and
		// a client that guessed the other one would find no field rather than an error it could act on.
		const restored = mutationFields()
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('restore'));

		expect(restored).toEqual([]);
		expect(mutationFields().map((field) => field.name.value)).toEqual(
			expect.arrayContaining(PARITY.filter(({ route }) => route === 'softRecover').map(({ field }) => field))
		);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the soft-delete pair — the two protocols retire and restore the same row', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](ID);
		const overGraphql = await resolver[entry.field](ID);

		// The inherited route hands over its rest parameter, which is an empty ARRAY, and the service
		// normalises both that and an absent argument to "no find options" — so the two are one call.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, []);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface acted on is the same row.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql).toBe(overRest);
	});

	it.each(PARITY)('$field retires recoverably rather than through a destructive removal', async (entry) => {
		const { service, resolver } = surfaces(entry);

		await resolver[entry.field](ID);

		// This is the whole point of the pair: the removal the endpoint already served for two of these
		// resources drops the row outright, and a caller left with only that has no recoverable removal
		// and therefore nothing to restore.
		expect(service.delete).not.toHaveBeenCalled();
		expect(service.softDelete).not.toHaveBeenCalled();
		expect(service[entry.method]).toHaveBeenCalledWith(ID);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is a write in both directions — retiring a membership takes a product out of a collection,
 * retiring a publication takes a variant off a channel — so a field that stated no grant of its own would
 * be one `PermissionGuard` answers `true` to, because it answers `true` to empty metadata: every
 * authenticated caller could retire or restore the row. The controllers' own `softRemove` / `softRecover`
 * overrides are where the REST surface closes that, and no resolver in this plugin states a class-level
 * grant that could close it here.
 */
describe('the soft-delete pair — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			// The override is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each controller’s own routes state, on the handler itself', () => {
		// Stated explicitly as well as by comparison, because these are the values a reader will look for:
		// two of the nine controllers gate the pair with the editing grant — the collection membership and
		// the relation, which are curated rather than published — and seven with the deleting one.
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and no resolver in this plugin states a
			// class-level grant that could stand in for the field's own — so a field that carried none would
			// be callable by every authenticated caller rather than refused.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of PARITY) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});
