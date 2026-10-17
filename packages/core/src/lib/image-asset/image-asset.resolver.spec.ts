/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, HttpException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ImageAssetController } from './image-asset.controller';
import { ImageAssetResolver } from './image-asset.resolver';

/**
 * The stored image over GraphQL.
 *
 * The delivered `/api/image-assets` routes serve a count, a page, a list, one image, a filing, an
 * edit, a removal, the lifecycle pair and an upload. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities but the upload is a root field, and the list is a connection with
 *   the platform's own cursor codec behind it;
 * - **the upload is the one route that has no field, and the suite asserts the absence** rather than
 *   leaving a reader to wonder whether it was overlooked;
 * - every field reaches the same `ImageAssetService` method the REST route reaches;
 * - the guard chain is the controller's and every field states the permission pair its own route runs
 *   under — including the edit and the lifecycle pair, whose routes inherit the class's *add* pair;
 * - the removal answers the row and lets its refusal through, rather than flattening both outcomes
 *   into a boolean.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';
const USED = '00000000-0000-4000-8000-000000000012';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'cover.png',
		url: 'uploads/image_assets/cover.png',
		thumb: 'uploads/image_assets/thumb-cover.png',
		width: 1200,
		height: 800,
		size: 204800,
		isFeatured: true,
		storageProvider: 'LOCAL',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'avatar.png',
		url: 'uploads/image_assets/avatar.png',
		thumb: null,
		width: 256,
		height: 256,
		size: 8192,
		isFeatured: false,
		storageProvider: 'LOCAL',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const imageAssetService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		deleteAsset: jest.fn().mockResolvedValue(ROWS[0]),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { imageAssetService, resolver: new ImageAssetResolver(imageAssetService as never) };
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

/** The printed body of one type, object or input. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The member names of one declared type, read off the parsed schema rather than off its text. */
function fieldNames(name: string): string[] {
	const declared = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(declared?.getFields() ?? {});
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ImageAssetController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ImageAssetController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ImageAssetController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ImageAssetResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['imageAssets', 'findAll'],
	['imageAsset', 'findById'],
	['imageAssetCount', 'getCount'],
	['createImageAsset', 'create'],
	['updateImageAsset', 'update'],
	['deleteImageAsset', 'delete'],
	['softDeleteImageAsset', 'softRemove'],
	['recoverImageAsset', 'softRecover']
];

describe('ImageAssetResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['imageAssets', 'imageAsset', 'imageAssetCount']));
	});

	it('declares one mutation per delivered write route but the upload', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createImageAsset',
				'updateImageAsset',
				'deleteImageAsset',
				'softDeleteImageAsset',
				'recoverImageAsset'
			])
		);
	});

	it('declares no field for the upload, which is the one route a JSON field cannot carry', () => {
		// The route is a multipart request: the stored key, the file name, the byte count and the
		// provider's name all come from the delivery pipeline behind it, and this endpoint carries no
		// upload scalar to hand it a file part. A field named for the upload would be the creation under
		// another name, which is a different capability from the one the route serves.
		for (const name of ['uploadImageAsset', 'imageAssetUpload', 'uploadImage']) {
			expect(rootFields('Mutation')).not.toContain(name);
		}

		// What the creation accepts is the row, not the bytes. Asserted over the parsed input rather than
		// over its text, because the text carries the members' descriptions between the members.
		expect(fieldNames('CreateImageAssetInput')).toEqual([
			'organizationId',
			'name',
			'url',
			'thumb',
			'width',
			'height',
			'size',
			'isFeatured',
			'externalProviderId',
			'storageProvider'
		]);
		expect(printed).toMatch(/createImageAsset\(input: CreateImageAssetInput!\): ImageAsset!/);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ImageAssetConnection \{\s*nodes: \[ImageAsset!\]!\s*edges: \[ImageAssetEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ImageAssetEdge \{\s*node: ImageAsset!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ImageAssetFilter \{/);
		expect(printed).toMatch(/enum ImageAssetSortField \{\s*createdAt\s*updatedAt\s*name\s*size\s*isFeatured\s*\}/);
	});

	it('carries the row’s own columns, the withdrawal marker and none of the three back-references', () => {
		const image = body('ImageAsset', 'type');

		expect(image).toMatch(/url: String!/);
		expect(image).toMatch(/size: Float\b/);
		expect(image).toMatch(/fullUrl: String\b/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(image).toMatch(/deletedAt: DateTime/);
		// A product's featured image, its gallery and an equipment record all point *at* this row, and
		// the delivered reads join none of them.
		expect(image).not.toContain('productGallery');
		expect(image).not.toContain('productFeaturedImage');
		expect(image).not.toContain('equipmentImage');
	});

	it('states the byte count as an exact bound, because the column behind it is numeric', () => {
		expect(body('ImageAssetFilter', 'input')).toMatch(/size: DecimalFilter/);
		expect(body('ImageAssetFilter', 'input')).toMatch(/width: NumberFilter/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/imageAssetCount\(/);
	});
});

describe('ImageAssetResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, imageAssetService } = surfaces();

		const connection = await resolver.imageAssets(undefined, undefined, undefined, 20);

		expect(imageAssetService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.imageAssets()).nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, including the byte count', async () => {
		const { resolver } = surfaces();

		expect((await resolver.imageAssets({ isFeatured: { eq: true } })).nodes.map((n) => n.id)).toEqual([FIRST]);
		expect((await resolver.imageAssets({ size: { lte: '8192.000000' } })).nodes.map((n) => n.id)).toEqual([
			SECOND
		]);
		expect((await resolver.imageAssets({ name: { ilike: '%.png' } })).totalCount).toBe(2);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.imageAssets(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.imageAssets(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.imageAssets(undefined, [{ field: 'url', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.imageAssets({ productGallery: { eq: FIRST } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('ImageAssetResolver — one concept, two protocols, the same operations', () => {
	it('reads one image through the same service method the REST route calls', async () => {
		const { resolver, imageAssetService } = surfaces();

		expect(await resolver.imageAsset(FIRST)).toBe(ROWS[0]);
		expect(imageAssetService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for an image that is not there', async () => {
		const { resolver, imageAssetService } = surfaces();
		imageAssetService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.imageAsset(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, imageAssetService } = surfaces();

		expect(await resolver.imageAssetCount()).toBe(2);
		expect(imageAssetService.countBy).toHaveBeenCalledWith();
	});

	it('records an image through the same service method the REST create route calls', async () => {
		const { resolver, imageAssetService } = surfaces();

		await resolver.createImageAsset({ organizationId: ORGANIZATION, url: 'uploads/image_assets/cover.png' });

		expect(imageAssetService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, url: 'uploads/image_assets/cover.png' })
		);
	});

	it('changes an image through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, imageAssetService } = surfaces();

		const updated = await resolver.updateImageAsset({ id: FIRST, isFeatured: false });

		expect(imageAssetService.update).toHaveBeenCalledWith(FIRST, { isFeatured: false });
		expect(imageAssetService.findOneByIdString).toHaveBeenCalledWith(FIRST);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes an image through the delivered removal, which is not the CRUD base’s', async () => {
		const { resolver, imageAssetService } = surfaces();

		const removed = await resolver.deleteImageAsset(FIRST);

		// Not `delete`: the delivered method is the one that reads the two product relations and refuses
		// an image still in use.
		expect(imageAssetService.deleteAsset).toHaveBeenCalledWith(FIRST);
		expect(removed).toBe(ROWS[0]);
	});

	it('lets the removal’s refusal through rather than answering false', async () => {
		const { resolver, imageAssetService } = surfaces();
		const inUse = new HttpException('Image is under use', 400);

		imageAssetService.deleteAsset.mockRejectedValueOnce(inUse);

		const error = await resolver.deleteImageAsset(USED).catch((thrown) => thrown);

		// "It was removed" and "it is still in use" are two facts; a boolean cannot carry both, so the
		// field answers the row or the refusal and never a fabricated flag.
		expect(error).toBe(inUse);
		expect(isRefusal(error)).toBe(true);
	});

	it('withdraws and restores an image through the same service methods the REST routes call', async () => {
		const { resolver, imageAssetService } = surfaces();

		expect((await resolver.softDeleteImageAsset(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(imageAssetService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverImageAsset(FIRST)).toBe(ROWS[0]);
		expect(imageAssetService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, imageAssetService } = surfaces();

		imageAssetService.create.mockRejectedValueOnce(new BadRequestException('Error while creating image assets'));

		const error = await resolver
			.createImageAsset({ url: 'uploads/image_assets/cover.png' })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
	});
});

describe('ImageAssetResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ImageAssetResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ImageAssetController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ImageAssetResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(ImageAssetController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission pair the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ImageAssetResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ImageAssetController)
		);
	});

	it('states on every field the permission pair its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(ImageAssetController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the add pair on the edit and the lifecycle moves, because their routes do', () => {
		for (const field of ['imageAssets', 'imageAsset', 'imageAssetCount']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.MEDIA_GALLERY_VIEW
			]);
		}

		expect(permissionOfField('deleteImageAsset')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.MEDIA_GALLERY_DELETE
		]);

		// The edit, the withdrawal and the restoration are inherited from the CRUD base without a
		// permission of their own, so they run under the class's *add* pair — which is what the fields
		// state rather than an edit permission the routes do not carry.
		for (const field of ['createImageAsset', 'updateImageAsset', 'softDeleteImageAsset', 'recoverImageAsset']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD]);
		}

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ImageAssetController.prototype.update)).toBeUndefined();
		expect(permissionOfRoute(ImageAssetController, 'update')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.MEDIA_GALLERY_ADD
		]);
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
		getHandler: () => (ImageAssetResolver.prototype as never)[field],
		getClass: () => ImageAssetResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ImageAssetResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ImageAssetResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ImageAssetResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('imageAssets')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('imageAssets');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('imageAssets'))).resolves.toBe(true);
	});
});
