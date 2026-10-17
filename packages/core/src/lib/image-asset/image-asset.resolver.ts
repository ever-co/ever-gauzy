import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

/** The members `CreateImageAssetInput` declares in the schema. */
export interface ICreateImageAssetInput {
	organizationId?: Id;
	name?: string;
	url: string;
	thumb?: string;
	width?: number;
	height?: number;
	size?: number;
	isFeatured?: boolean;
	externalProviderId?: string;
	storageProvider?: string;
}

/** The members `UpdateImageAssetInput` declares in the schema. */
export interface IUpdateImageAssetInput extends Partial<ICreateImageAssetInput> {
	id: Id;
}

/**
 * The fields an image list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ImageAssetFilter` and `ImageAssetSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable
 * in the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `size` is `DECIMAL` rather than `NUMBER`: the column behind it is `numeric`, and a byte count is
 * routinely larger than a whole number's range — a gallery narrowed to "everything under a limit" is
 * the read this member exists for, and a bound compared through a binary fraction would select the
 * wrong rows.
 */
const IMAGE_ASSET_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	url: 'STRING',
	thumb: 'STRING',
	width: 'NUMBER',
	height: 'NUMBER',
	size: 'DECIMAL',
	isFeatured: 'BOOLEAN',
	externalProviderId: 'STRING',
	storageProvider: 'STRING',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const IMAGE_ASSET_SORTABLE = ['createdAt', 'updatedAt', 'name', 'size', 'isFeatured'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: newest first, because a gallery is browsed from the end that
 * has just been filled, then the identifier, which is the key that makes the order total and a cursor
 * walk over it stable.
 */
const IMAGE_ASSET_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The stored image over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ImageAssetService` the `/api/image-assets` routes call.
 *
 * **One delivered route has no field here, and it is the upload.** `POST /image-assets/upload/:folder`
 * is a multipart request whose handler takes no address, no byte count and no thumbnail from its body
 * at all: the stored key, the original file name, the size and the provider's name are produced by the
 * delivery pipeline behind it, which also sanitises the folder, scopes the destination to the caller's
 * tenant, filters the upload to raster images, re-reads the stored bytes to reject markup that would
 * execute when the file is served, generates a thumbnail through the image library, and deletes the
 * stored file when the markup check rejects it. A field over a JSON body has no file part to hand any
 * of that, and this endpoint carries no upload scalar and no upload middleware to invent one from. A
 * field that accepted an address the caller had put somewhere itself would be the creation below
 * wearing the upload's name — a different capability — so the gap is stated rather than papered over.
 *
 * **The guard chain and the class permission are the controller's.** `ImageAssetController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ALL_ORG_EDIT` with
 * `MEDIA_GALLERY_ADD` there, so this class carries the same two guards, the gate below and that pair.
 * Each field then states the pair its own route runs under: the four reads the view pair, the removal
 * the delete pair, and everything else the class pair — which is why the edit and the two lifecycle
 * moves state the *add* permission rather than an edit one. That reads oddly and is nevertheless the
 * parity: those four routes are inherited from the CRUD base without a permission of their own, so
 * they run under the class pair, and restating them as an edit permission here would give GraphQL a
 * scope REST does not have.
 *
 * **The removal answers the row and can refuse.** The delivered removal is not the CRUD base's: it
 * loads the asset with the two product relations and raises a `400` when either still points at it.
 * The field answers the row it took and lets that refusal through, rather than flattening both
 * outcomes into a boolean that cannot tell "it was removed" from "it is still in use".
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('ImageAsset')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
export class ImageAssetResolver {
	constructor(private readonly imageAssetService: ImageAssetService) {}

	/**
	 * The images of the caller's tenant, newest first.
	 */
	@Query('imageAssets')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	async imageAssets(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<ImageAsset>> {
		// The delivered list route hands the service the query DTO it bound from the query string. This
		// surface has no query string to bind, so the read runs with the route's own defaults — no
		// criterion, no relations, no page — and the connection protocol's `filter` narrows the rows the
		// service returns. The tenant is applied to the criterion by the service.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<ImageAsset>;
		const { items }: IPagination<ImageAsset> = await this.imageAssetService.findAll(options);

		return buildConnection<ImageAsset>({
			rows: items ?? [],
			filterable: IMAGE_ASSET_FILTERABLE,
			sortable: IMAGE_ASSET_SORTABLE,
			defaultSort: IMAGE_ASSET_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One image of the caller's tenant.
	 *
	 * An image that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('imageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	async imageAsset(@Args('id', { type: () => ID }) id: Id): Promise<ImageAsset | null> {
		try {
			return await this.imageAssetService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many images the caller's tenant holds.
	 */
	@Query('imageAssetCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	async imageAssetCount(): Promise<number> {
		return await this.imageAssetService.countBy();
	}

	/**
	 * Records an image through the same service method the delivered create route calls.
	 *
	 * This is the creation, not the upload: what it writes is the row, and the bytes the row points at
	 * are the caller's to have put in place. The delivered `create` wraps a failure in a `400` and logs
	 * the caller whose write failed, so the field lets that refusal through rather than swallowing it.
	 */
	@Mutation('createImageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	async createImageAsset(@Args('input') input: ICreateImageAssetInput): Promise<ImageAsset> {
		return await this.imageAssetService.create(input as unknown as ImageAsset);
	}

	/**
	 * Changes an image through the same service method the delivered edit route calls.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is
	 * not a row and not what a GraphQL field named `updateImageAsset` may return.
	 */
	@Mutation('updateImageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	async updateImageAsset(@Args('input') input: IUpdateImageAssetInput): Promise<ImageAsset> {
		const { id, ...values } = input;

		await this.imageAssetService.update(id, values as QueryDeepPartialEntity<ImageAsset>);

		return await this.imageAssetService.findOneByIdString(id);
	}

	/**
	 * Removes an image through the delivered removal, which is not the CRUD base's.
	 *
	 * The delivered method loads the asset with the two product relations and refuses with a `400` when
	 * either still points at it, so "it was removed" and "it is still in use" are two answers rather
	 * than one boolean. The field answers the row it took, which is what the route answers.
	 */
	@Mutation('deleteImageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_DELETE)
	async deleteImageAsset(@Args('id', { type: () => ID }) id: Id): Promise<ImageAsset> {
		return await this.imageAssetService.deleteAsset(id);
	}

	/**
	 * Withdraws an image: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteImageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	async softDeleteImageAsset(@Args('id', { type: () => ID }) id: Id): Promise<ImageAsset> {
		return await this.imageAssetService.softRemove(id);
	}

	/**
	 * Puts a withdrawn image back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverImageAsset')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	async recoverImageAsset(@Args('id', { type: () => ID }) id: Id): Promise<ImageAsset> {
		return await this.imageAssetService.softRecover(id);
	}
}
