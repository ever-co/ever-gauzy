/**
 * The write routes this package genuinely did not answer, and the reading that collapsed the rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **twenty-seven** of this package's
 * fifty-three write routes — which is not a gap count, because the instrument is name-blind in the two
 * directions that matter here. It expects a CRUD handler to be answered by `<verb><Resource>`
 * (`softRemove` → `softDelete<Resource>`, `softRecover` → `recover<Resource>`) and an action handler to be
 * named somewhere, and it flags:
 *
 * - **the create, update and delete route of each of the seven child resources** (`collection-products`,
 *   `collection-variants`, `collection-channels`, `product-channels`, `product-variant-channels`,
 *   `product-variant-media`, `product-variant-tags`) — twenty-one routes, every one of them a pivot or a
 *   child of a first-class resource, and every one of them reached through the parent's or a sibling's
 *   field rather than by a field of its own name;
 * - **six `replace*` action routes** (`replaceProducts`, `replaceVariants`, `replaceChannels`,
 *   `replacePublications`, `replaceMedia`, `replaceTags`), five of which are the service calls their
 *   resources' set fields wrap — `replaceProducts` under `addCollectionProducts` and
 *   `removeCollectionProducts`, `replaceChannels` under `assignCollectionChannel` and
 *   `unassignCollectionChannel`, `replacePublications` under `publishProductVariant`, `replaceMedia`
 *   under `attachProductVariantMedia`, `replaceTags` under `attachProductVariantFacets` — and one of
 *   which, `replaceVariants`, wraps nothing at all: that resource has no bound set field, which is why
 *   the route is one of the three this suite delivers.
 *
 * The lifecycle pair is *not* among the twenty-seven: this package spells `softDelete<Resource>` and
 * `recover<Resource>` the way the audit expects, and `soft-delete.spec.ts` beside this file is their suite.
 * The two `publish` routes are not flagged either — `publishProduct` carries a noun the handler does not,
 * which is the instrument's other blind spot.
 *
 * Twenty-one plus six is **twenty-seven**, and the reading collapses **twenty-four** of them: **nineteen
 * child routes** — every create and every delete of the seven, and five of the seven updates — plus **five
 * `replace*` routes**. What it leaves is **three**, and the three are not all of one shape: the one
 * `replace*` route with no wrapper behind it, and the two child updates whose bodies carry members no field
 * can write. They are the three this suite is about:
 *
 * - `replaceCollectionVariants` — `PUT /collection-variants/by-collection/:collectionId`. The set field its
 *   siblings have does not exist for this resource: the document declares `addCollectionVariants` and
 *   `removeCollectionVariants`, neither has a resolver, and the note recording them as unbound in
 *   `tools/scripts/graphql-field-binding-check.mjs` reads "the variant service replaces a whole membership
 *   set; an add is not defined". A REST caller could write a collection's variant set in one call and a
 *   GraphQL caller could not write it at all.
 * - `updateProductChannel` — `PUT /product-channels/:id`. `publishProduct` and `unpublishProduct` are
 *   status transitions over a set of channels; they answer the body's status and its dates, and they do not
 *   answer `sortOrder` or `isFeatured`, which are the row's place in a channel's listing — the members the
 *   read path orders by, writable over REST and reachable by no field.
 * - `updateProductVariantChannel` — `PUT /product-variant-channels/:id`, the same body shape and the same
 *   unreachable `sortOrder`.
 *
 * Three properties are pinned for each, exactly as the lifecycle pair's suite pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of every one of these
 *   controllers is the view grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches**, because two protocols
 *   that perform one act differently are two behaviours waiting to diverge — and it mirrors the route's
 *   `@Idempotent` scope and `@Versioned` expectation where the route declares one, which none of these
 *   three does.
 *
 * **The twenty-four collapsed routes are asserted rather than described**, so the reading is a test and
 * not a paragraph: for each one the name the audit looked for is declared *absent* from the document, and
 * the field that serves the capability is declared *present*. **Nothing is doubled here but the services.**
 * The controllers are the real ones, the resolvers are the real ones, `CrudController` behind them is the
 * kernel's own, and the document the fields are read out of is the real one — the service is the seam the
 * parity requirement is about, and one stub per resource is what makes "the same method with the same
 * arguments" visible without a database behind it.
 */

import { getMetadataStorage } from 'class-validator';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { CollectionChannelController } from '../../collection-channel/collection-channel.controller';
import { CollectionProductController } from '../../collection-product/collection-product.controller';
import { CollectionVariantController } from '../../collection-variant/collection-variant.controller';
import { ProductChannelController } from '../../product-channel/product-channel.controller';
import { ProductChannelDTO } from '../../product-channel/dto';
import { ProductVariantChannelController } from '../../product-variant-channel/product-variant-channel.controller';
import { ProductVariantChannelDTO } from '../../product-variant-channel/dto';
import { ProductVariantMediaController } from '../../product-variant-media/product-variant-media.controller';
import { TagProductVariantController } from '../../tag-product-variant/tag-product-variant.controller';
import { schemaExtensions } from '../schema-extensions';
import { CollectionVariantResolver } from './collection-variant.resolver';
import { ProductPublicationResolver } from './product-publication.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000042';
const COLLECTION = '00000000-0000-4000-8000-000000000043';
const VARIANTS = ['00000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000045'];

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that writes a variant set over GraphQL and one that
 * writes it over REST must be looking at the same membership afterwards.
 */
const MEMBERSHIP = [
	{ id: '00000000-0000-4000-8000-000000000046', collectionId: COLLECTION, variantId: VARIANTS[0], position: 0 }
];
const PUBLICATION = { id: ID, productId: 'p', channelId: 'c', status: 'ACTIVE', sortOrder: 3, isFeatured: true };
const VARIANT_PUBLICATION = { id: ID, variantId: 'v', channelId: 'c', status: 'ACTIVE', sortOrder: 3 };

/** The stub that owns each of the three capabilities, which is the service the field must reach. */
type ServiceKey = 'variantMembership' | 'productPublication' | 'variantPublication';

/** One of the three routes, its two surfaces, and what its field must mirror. */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for, which is not always the name the field carries. */
	expects: string;
	/** The arguments the route's handler takes — the path member and the body. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with, which is what the resource's other mutations answer. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: string;
	/** The method both surfaces must reach. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The three routes no field answered.
 *
 * Each is a capability rather than a spare route: a collection's variant set, and a publication row's own
 * place in a channel's listing — neither of which any field reaches, because the set fields the siblings
 * have are absent for the variant membership and cover only the status and the dates of a publication.
 */
const PARITY: IParity[] = [
	{
		field: 'replaceCollectionVariants',
		route: 'replaceVariants',
		resource: 'CollectionVariant',
		expects: 'replaceVariants',
		routeArgs: [COLLECTION, { variantIds: VARIANTS }],
		fieldArgs: [COLLECTION, VARIANTS],
		serviceArgs: [COLLECTION, VARIANTS],
		declared: [
			['collectionId', 'ID'],
			['variantIds', 'ID']
		],
		answers: 'CollectionVariant',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT),
		method: 'replaceVariants',
		service: 'variantMembership',
		controller: CollectionVariantController,
		resolver: CollectionVariantResolver,
		build: (stubs) => ({
			controller: new CollectionVariantController(stubs.variantMembership) as Row,
			resolver: new CollectionVariantResolver(stubs.variantMembership) as Row
		})
	},
	{
		field: 'updateProductChannel',
		route: 'update',
		resource: 'ProductChannel',
		expects: 'updateProductChannel',
		routeArgs: [ID, { sortOrder: 3, isFeatured: true }],
		fieldArgs: [ID, { sortOrder: 3, isFeatured: true }],
		serviceArgs: [ID, { sortOrder: 3, isFeatured: true }],
		declared: [
			['id', 'ID'],
			['input', 'UpdateProductPublicationInput']
		],
		answers: 'ProductPublication',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT),
		method: 'update',
		service: 'productPublication',
		controller: ProductChannelController,
		resolver: ProductPublicationResolver,
		build: (stubs) => ({
			controller: new ProductChannelController(stubs.productPublication) as Row,
			resolver: new ProductPublicationResolver(
				stubs.productPublication,
				stubs.variantPublication,
				{ ofType: () => null } as never
			) as Row
		})
	},
	{
		field: 'updateProductVariantChannel',
		route: 'update',
		resource: 'ProductVariantChannel',
		expects: 'updateProductVariantChannel',
		routeArgs: [ID, { sortOrder: 3 }],
		fieldArgs: [ID, { sortOrder: 3 }],
		serviceArgs: [ID, { sortOrder: 3 }],
		declared: [
			['id', 'ID'],
			['input', 'UpdateProductVariantPublicationInput']
		],
		answers: 'ProductVariantPublication',
		grant: catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT),
		method: 'update',
		service: 'variantPublication',
		controller: ProductVariantChannelController,
		resolver: ProductPublicationResolver,
		build: (stubs) => ({
			controller: new ProductVariantChannelController(stubs.variantPublication) as Row,
			resolver: new ProductPublicationResolver(
				stubs.productPublication,
				stubs.variantPublication,
				{ ofType: () => null } as never
			) as Row
		})
	}
];

/**
 * The twenty-four routes the reading collapsed, each with the field that already serves it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is — the
 * audit's expectation for each is asserted absent below, so this table fails if a future wave renames one
 * of the serving fields out from under the routes that name it in their own docstrings. The `field` is the
 * door a caller reaches the capability through, which for a set field is the whole set:
 * `addCollectionProducts` and `removeCollectionProducts` both call `replaceProducts`,
 * `assignCollectionChannel` and `unassignCollectionChannel` both call `replaceChannels`, and
 * `attachProductVariantMedia` and `attachProductVariantFacets` call `replaceMedia` and `replaceTags`.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	field: string;
}[] = [
	// A product membership of a collection: curated through the set fields, and addressed row by row only
	// for its recoverable retirement, which `softDeleteCollectionProduct` answers.
	{
		controller: CollectionProductController,
		resource: 'CollectionProduct',
		route: 'create',
		expects: 'createCollectionProduct',
		field: 'addCollectionProducts'
	},
	{
		controller: CollectionProductController,
		resource: 'CollectionProduct',
		route: 'update',
		expects: 'updateCollectionProduct',
		field: 'addCollectionProducts'
	},
	{
		controller: CollectionProductController,
		resource: 'CollectionProduct',
		route: 'delete',
		expects: 'deleteCollectionProduct',
		field: 'removeCollectionProducts'
	},
	{
		controller: CollectionProductController,
		resource: 'CollectionProduct',
		route: 'replaceProducts',
		expects: 'replaceProducts',
		field: 'addCollectionProducts'
	},
	// A variant membership: the same set semantics, and the set field this wave delivers is the door — the
	// document's `addCollectionVariants` and `removeCollectionVariants` are declared with no resolver.
	{
		controller: CollectionVariantController,
		resource: 'CollectionVariant',
		route: 'create',
		expects: 'createCollectionVariant',
		field: 'replaceCollectionVariants'
	},
	{
		controller: CollectionVariantController,
		resource: 'CollectionVariant',
		route: 'update',
		expects: 'updateCollectionVariant',
		field: 'replaceCollectionVariants'
	},
	{
		controller: CollectionVariantController,
		resource: 'CollectionVariant',
		route: 'delete',
		expects: 'deleteCollectionVariant',
		field: 'replaceCollectionVariants'
	},
	// Where a collection is published: one row per channel, and `assignCollectionChannel` takes exactly the
	// members the row's own create and update bodies carry.
	{
		controller: CollectionChannelController,
		resource: 'CollectionChannel',
		route: 'create',
		expects: 'createCollectionChannel',
		field: 'assignCollectionChannel'
	},
	{
		controller: CollectionChannelController,
		resource: 'CollectionChannel',
		route: 'update',
		expects: 'updateCollectionChannel',
		field: 'assignCollectionChannel'
	},
	{
		controller: CollectionChannelController,
		resource: 'CollectionChannel',
		route: 'delete',
		expects: 'deleteCollectionChannel',
		field: 'unassignCollectionChannel'
	},
	{
		controller: CollectionChannelController,
		resource: 'CollectionChannel',
		route: 'replaceChannels',
		expects: 'replaceChannels',
		field: 'assignCollectionChannel'
	},
	// A product publication: `publishProduct` creates the row and moves its status, and the row is kept
	// rather than dropped — the entity records `unpublishedAt` as non-null exactly while the row is not
	// `ACTIVE`, and `softDeleteProductChannel` is the recoverable retirement beside it — so the removal the
	// route performs by dropping the row is the withdrawal the route's own docstring names.
	{
		controller: ProductChannelController,
		resource: 'ProductChannel',
		route: 'create',
		expects: 'createProductChannel',
		field: 'publishProduct'
	},
	{
		controller: ProductChannelController,
		resource: 'ProductChannel',
		route: 'delete',
		expects: 'deleteProductChannel',
		field: 'unpublishProduct'
	},
	// A variant publication: the same shape, through `publishProductVariant`, which wraps the set route's
	// own service call.
	{
		controller: ProductVariantChannelController,
		resource: 'ProductVariantChannel',
		route: 'create',
		expects: 'createProductVariantChannel',
		field: 'publishProductVariant'
	},
	{
		controller: ProductVariantChannelController,
		resource: 'ProductVariantChannel',
		route: 'delete',
		expects: 'deleteProductVariantChannel',
		field: 'unpublishProductVariant'
	},
	{
		controller: ProductVariantChannelController,
		resource: 'ProductVariantChannel',
		route: 'replacePublications',
		expects: 'replacePublications',
		field: 'publishProductVariant'
	},
	// A gallery row: attached, reordered and detached through the variant, which is the parent the gallery
	// belongs to.
	{
		controller: ProductVariantMediaController,
		resource: 'ProductVariantMedia',
		route: 'create',
		expects: 'createProductVariantMedia',
		field: 'attachProductVariantMedia'
	},
	{
		controller: ProductVariantMediaController,
		resource: 'ProductVariantMedia',
		route: 'update',
		expects: 'updateProductVariantMedia',
		field: 'reorderProductVariantMedia'
	},
	{
		controller: ProductVariantMediaController,
		resource: 'ProductVariantMedia',
		route: 'delete',
		expects: 'deleteProductVariantMedia',
		field: 'detachProductVariantMedia'
	},
	{
		controller: ProductVariantMediaController,
		resource: 'ProductVariantMedia',
		route: 'replaceMedia',
		expects: 'replaceMedia',
		field: 'attachProductVariantMedia'
	},
	// A facet of a variant: the row's value is the tag and its position is the order of the set, so the
	// attach and detach fields are the door.
	{
		controller: TagProductVariantController,
		resource: 'TagProductVariant',
		route: 'create',
		expects: 'createTagProductVariant',
		field: 'attachProductVariantFacets'
	},
	{
		controller: TagProductVariantController,
		resource: 'TagProductVariant',
		route: 'update',
		expects: 'updateTagProductVariant',
		field: 'attachProductVariantFacets'
	},
	{
		controller: TagProductVariantController,
		resource: 'TagProductVariant',
		route: 'delete',
		expects: 'deleteTagProductVariant',
		field: 'detachProductVariantFacets'
	},
	{
		controller: TagProductVariantController,
		resource: 'TagProductVariant',
		route: 'replaceTags',
		expects: 'replaceTags',
		field: 'attachProductVariantFacets'
	}
];

/**
 * The two surfaces over the stubs that own them.
 *
 * One stub per resource, and every stub carries every method under test: the publication resolver holds
 * *both* publication services, so a field that reached the wrong one has to be visible as an assertion
 * about the wrong stub rather than as a passing comparison.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		variantMembership: {
			replaceVariants: jest.fn().mockResolvedValue(MEMBERSHIP),
			update: jest.fn().mockResolvedValue(MEMBERSHIP[0]),
			create: jest.fn().mockResolvedValue(MEMBERSHIP[0]),
			removeVariant: jest.fn().mockResolvedValue(undefined),
			softRemove: jest.fn().mockResolvedValue(MEMBERSHIP[0]),
			softRecover: jest.fn().mockResolvedValue(MEMBERSHIP[0])
		},
		productPublication: {
			replaceVariants: jest.fn().mockResolvedValue(MEMBERSHIP),
			update: jest.fn().mockResolvedValue(PUBLICATION),
			findOneByIdString: jest.fn().mockResolvedValue(PUBLICATION),
			setPublication: jest.fn().mockResolvedValue([PUBLICATION]),
			softRemove: jest.fn().mockResolvedValue(PUBLICATION),
			softRecover: jest.fn().mockResolvedValue(PUBLICATION)
		},
		variantPublication: {
			replaceVariants: jest.fn().mockResolvedValue(MEMBERSHIP),
			update: jest.fn().mockResolvedValue(VARIANT_PUBLICATION),
			findOneByIdString: jest.fn().mockResolvedValue(VARIANT_PUBLICATION),
			replacePublications: jest.fn().mockResolvedValue([VARIANT_PUBLICATION]),
			softRemove: jest.fn().mockResolvedValue(VARIANT_PUBLICATION),
			softRecover: jest.fn().mockResolvedValue(VARIANT_PUBLICATION)
		}
	};

	const { controller, resolver } = entry.build(stubs);

	return { stubs, controller, resolver };
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

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the catalog document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One input type, as the document spells it. */
function inputType(name: string): InputObjectTypeDefinitionNode {
	const input = schemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (!input) {
		throw new Error(`the catalog document declares no input named "${name}"`);
	}

	return input;
}

/** The members an input type declares, sorted. */
function inputMembers(name: string): string[] {
	return (inputType(name).fields ?? []).map((field) => field.name.value).sort();
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/**
 * The members a DTO declares itself, read from the validation metadata its own decorators wrote.
 *
 * Filtered by target rather than read wholesale: `getTargetValidationMetadatas` answers a class's
 * inherited declarations too, and the scope members its base carries — the tenant, the organization and
 * the organization object — belong to the credential rather than to a body. No input in this document
 * states them, and a comparison that read them would demand that one did.
 *
 * @param dto The DTO to read.
 * @returns Its own members, sorted.
 */
function dtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage()
		.getTargetValidationMetadatas(dto, '', false, false)
		.filter((entry) => entry.target === dto);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * The schema's half of the three fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the catalog document — the three routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
				// `ID!` and `[ID!]!` rather than a nullable argument: a write that names no row is not a
				// write, and an absent input would be a request the route's own validation pipe refuses.
				expect(arguments_[index].type.kind).toBe('NonNullType');
			}
		}
	});

	it('answers the row each route answers, which is what the resource’s other mutations answer', () => {
		// The REST routes answer the row they wrote — the variant membership rows after a set write, and the
		// publication as the update left it — and so does every single-row mutation this plugin already
		// declares, so the three follow that rather than a second shape invented for them. The two
		// publication resources answer the publication types their own queries answer, because that is what
		// those tables are served as.
		for (const { field, answers } of PARITY) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('declares the members the route’s own body carries, and only those', () => {
		// Read from the DTO each route validates its body with rather than restated here, so a member added
		// to a DTO and not to the input fails this. The row's business key is the one exclusion: the route's
		// body is a `PartialType` of the whole shape, while the field names the row by identifier, and a
		// publication that could be repointed at another product or channel would be a move rather than an
		// update.
		const publication = dtoMembers(ProductChannelDTO).filter(
			(member) => !['channelId', 'productId'].includes(member)
		);

		expect(inputMembers('UpdateProductPublicationInput')).toEqual(publication);

		const variantPublication = dtoMembers(ProductVariantChannelDTO).filter(
			(member) => !['channelId', 'variantId'].includes(member)
		);

		expect(inputMembers('UpdateProductVariantPublicationInput')).toEqual(variantPublication);

		// A control, so the two comparisons above cannot pass on two empty readings.
		expect(publication).toEqual(['isFeatured', 'publishedAt', 'sortOrder', 'status', 'unpublishedAt']);
		expect(variantPublication).toEqual(['publishedAt', 'sortOrder', 'status', 'unpublishedAt']);
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
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
			expect(declares(name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the three fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface wrote is the same row.
		expect(overGraphql).toBe(overRest);
	});

	it.each(PARITY)('$field writes through its own service and not a sibling’s', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		for (const [name, stub] of Object.entries(stubs)) {
			expect(stub[entry.method]).toHaveBeenCalledTimes(name === entry.service ? 2 : 0);
		}
	});

	it('answers the row it wrote, reading it back where the service’s update answers a result', async () => {
		// The CRUD base's `update` answers the updated row *or* an `UpdateResult`, so a field typed as a
		// non-null row reads the row back — the same read the cart's session update makes for the same
		// reason — and a field that returned the write's own result would break its own type.
		for (const entry of PARITY.filter((candidate) => candidate.method === 'update')) {
			const { stubs, controller, resolver } = surfaces(entry);

			await controller[entry.route](...entry.routeArgs);
			const answer = await resolver[entry.field](...entry.fieldArgs);

			expect(stubs[entry.service].update).toHaveBeenCalledTimes(2);
			expect(stubs[entry.service].findOneByIdString).toHaveBeenCalledTimes(1);
			expect(stubs[entry.service].findOneByIdString).toHaveBeenCalledWith(ID);
			expect(answer).toBe(await stubs[entry.service].findOneByIdString(ID));
		}
	});

	it('writes the variant set rather than a row of it, which is the capability the route serves', async () => {
		// `replaceVariants` is the operation this resource's service defines — the note recording
		// `addCollectionVariants` / `removeCollectionVariants` as unbound in the field-binding gate says so
		// — so the field must not reach the row-level create or remove the document does not mirror.
		const { stubs, controller, resolver } = surfaces(PARITY[0]);

		await controller[PARITY[0].route](...PARITY[0].routeArgs);
		await resolver[PARITY[0].field](...PARITY[0].fieldArgs);

		expect(stubs.variantMembership.create).not.toHaveBeenCalled();
		expect(stubs.variantMembership.removeVariant).not.toHaveBeenCalled();
		expect(stubs.variantMembership.replaceVariants).toHaveBeenCalledTimes(2);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the three is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could rewrite
 * a collection's variant set or a publication's listing rank. No resolver in this plugin states a
 * class-level grant that could close that, which is why the comparison is against the route's own handler
 * metadata rather than against the class.
 */
describe('the three fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and no resolver in this plugin states a
			// class-level grant that could stand in for the field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// None of the three routes carries `@Idempotent` or `@Versioned`, so neither does any of the three
		// fields: a keyless GraphQL retry would then not dedupe where REST does, and a version expectation
		// invented here would refuse writes the route accepts.
		for (const { field, route, controller, resolver } of PARITY) {
			for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
				expect(Reflect.getMetadata(key, fieldsOf(resolver)[field])).toBeUndefined();
				expect(Reflect.getMetadata(key, handlersOf(controller)[route])).toBeUndefined();
			}
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

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the name it looked for is
 * absent from the document, and the field that serves the capability is present. A future wave that
 * renames a serving field, or that adds one of these twenty-four names without meaning to, fails here.
 */
describe('the twenty-four collapsed routes — served under another name, not unserved', () => {
	it('flags twenty-seven routes, collapses twenty-four and implements three', () => {
		expect(COLLAPSED).toHaveLength(24);
		expect(PARITY).toHaveLength(3);

		// The prose's arithmetic, asserted rather than left to a reader: of the twenty-four collapsed
		// routes, five are `replace*` action routes and nineteen are a child's own create, update or
		// delete — which is the seven resources' three CRUD routes less the two updates this suite
		// delivers. Of the three genuine routes, one is the `replace*` route with no wrapper behind it and
		// two are those child updates.
		expect(COLLAPSED.filter(({ route }) => route.startsWith('replace'))).toHaveLength(5);
		expect(COLLAPSED.filter(({ route }) => ['create', 'update', 'delete'].includes(route))).toHaveLength(19);
		expect(PARITY.filter(({ route }) => route.startsWith('replace'))).toHaveLength(1);
		expect(PARITY.filter(({ route }) => route === 'update')).toHaveLength(2);

		// Seven child resources, three CRUD routes each, twenty-one flagged; two of them genuine leaves the
		// nineteen collapsed above, and twenty-one child routes plus six `replace*` routes is the
		// twenty-seven the audit reports.
		expect(7 * 3 - 2).toBe(19);
		expect(7 * 3 + 6).toBe(27);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field', ({ controller, route, expects, field }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the
		// surface rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — the name it built from the handler and the resource is not a
		// field — while the capability is answered by the field the table names.
		expect(declares(expects)).toBe(false);
		expect(declares(field)).toBe(true);
	});

	it('names the two publication updates the way the audit expected, and the set route differently', () => {
		// The two update routes are mirrored under the name the audit looked for, because the resource's own
		// update route is what they answer. The set route is not: `replaceVariants` is the handler, and the
		// field this wave delivers is named for the resource it writes — `replaceCollectionVariants` —
		// because `replaceVariants` alone would read as a variant's own replacement beside
		// `publishProductVariant` and `attachProductVariantMedia`.
		expect(declares('updateProductChannel')).toBe(true);
		expect(declares('updateProductVariantChannel')).toBe(true);
		expect(declares('replaceVariants')).toBe(false);
		expect(declares('replaceCollectionVariants')).toBe(true);
	});
});
