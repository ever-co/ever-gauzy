import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IPagination,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant,
	PermissionsEnum
} from '@gauzy/contracts';
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
import { Warehouse } from './warehouse.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { WarehouseProductVariant } from './warehouse-product-variant.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseProductService } from './warehouse-product-service';

/** The members `CreateWarehouseInput` declares in the schema. */
export interface ICreateWarehouseInput {
	organizationId: Id;
	name: string;
	code: string;
	email: string;
	description?: string;
	active?: boolean;
	logoId?: Id;
	contactId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateWarehouseInput` declares in the schema. */
export interface IUpdateWarehouseInput extends ICreateWarehouseInput {
	id: Id;
}

/** The members `AddWarehouseProductsInput` declares in the schema. */
export interface IAddWarehouseProductsInput {
	productIds: Id[];
}

/**
 * The fields a location list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `WarehouseFilter` and `WarehouseSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The nine columns the delivered body cannot write are filterable even so, because a filter is a
 * read: a caller that cannot file a location which ships can still ask which of its locations do.
 */
const WAREHOUSE_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	code: 'STRING',
	email: 'STRING',
	description: 'STRING',
	active: 'BOOLEAN',
	type: 'STRING',
	priority: 'NUMBER',
	isPickupLocation: 'BOOLEAN',
	isFulfillmentLocation: 'BOOLEAN',
	timezone: 'STRING',
	cutoffTime: 'STRING',
	sellerId: 'ID',
	logoId: 'ID',
	contactId: 'ID',
	metadata: 'JSON',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const WAREHOUSE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code', 'email', 'priority'] as const;

/**
 * The order the location connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: newest first, because a network of locations is read as it is
 * built out, then the identifier, which is the key that makes the order total and a cursor walk over
 * it stable.
 */
const WAREHOUSE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The fields a stock-level list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * Every quantity is `DECIMAL` rather than `NUMBER`: the columns behind them are `numeric`, and a
 * bound compared through a binary fraction would select the wrong rows — `10.10` is the case that
 * makes the point.
 */
const WAREHOUSE_PRODUCT_FILTERABLE = {
	id: 'ID',
	warehouseId: 'ID',
	productId: 'ID',
	quantity: 'DECIMAL',
	reservedQuantity: 'DECIMAL',
	incomingQuantity: 'DECIMAL',
	safetyStock: 'DECIMAL',
	allowBackorder: 'BOOLEAN',
	backorderLimit: 'DECIMAL',
	restockThreshold: 'DECIMAL',
	trackInventory: 'BOOLEAN',
	isUnlimited: 'BOOLEAN',
	binLocation: 'STRING',
	version: 'NUMBER',
	metadata: 'JSON',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const WAREHOUSE_PRODUCT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'quantity',
	'reservedQuantity',
	'productId',
	'binLocation'
] as const;

/**
 * The order the stock-level connection answers in when the caller states none.
 *
 * The delivered read declares no order either — it hands the store a criterion and takes the rows as
 * they come back, which differs between installations — so the connection states one: the level with
 * the least on hand first, because a stock list is read to find what is running out, then the
 * identifier, which is the key that makes the order total.
 */
const WAREHOUSE_PRODUCT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'quantity', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The stock location over GraphQL, with the stock levels one controller serves beside it.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `WarehouseService` or `WarehouseProductService` method
 * the `/api/warehouses` routes call.
 *
 * **The guard chain and the class permission are the controller's.** `WarehouseController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states
 * `ORG_INVENTORY_PRODUCT_EDIT` there, so this class carries the same two guards, the gate below, and
 * that permission. The four reads state the view permission their routes state; the location's
 * filing and edit, the three inherited writes and all four inventory writes state the class's edit
 * one, which is what their routes run under. Narrowing the inventory writes to the view permission —
 * which their subject matter suggests, since they read as bookkeeping — would give one protocol a
 * scope the other does not have.
 *
 * **Two resources share this resolver, and they share it because one controller serves them.** A
 * resolver is a class over a resource, and the resource here is the `/api/warehouses` file: the
 * location, and the level rows that file's four inventory routes read and write. They are two Nest
 * *types* because they are two rows, and one resolver because they are one route set with one guard
 * chain and one class permission — splitting them would give two classes that each had to restate
 * the whole of the other's metadata to be auditable.
 *
 * **Nine columns of the location are readable and not writeable**, and that is the delivered body's
 * shape rather than a decision taken here: the write DTOs carry none of the location's kind, rank,
 * role flags, coordinates, zone, cutoff, seller or metadata, and the delivered routes validate with
 * `whitelist: true`, which strips a member the DTO does not declare. The inputs state only what a
 * delivered body can carry; the columns are still readable, and still filterable, because a filter is
 * a read.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Warehouse')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
export class WarehouseResolver {
	constructor(
		private readonly warehouseService: WarehouseService,
		private readonly warehouseProductService: WarehouseProductService
	) {}

	/**
	 * The stock locations of the caller's tenant, newest first.
	 */
	@Query('warehouses')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async warehouses(
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
	): Promise<GraphqlConnection<Warehouse>> {
		// The delivered list route hands the service the query DTO it bound from the query string. This
		// surface has no query string to bind, so the read runs with the route's own defaults — no
		// criterion, no relations, no page — and the connection protocol's `filter` narrows the rows the
		// service returns. The tenant is applied to the criterion by the service.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Warehouse>;
		const { items }: IPagination<Warehouse> = await this.warehouseService.findAll(options);

		return buildConnection<Warehouse>({
			rows: items ?? [],
			filterable: WAREHOUSE_FILTERABLE,
			sortable: WAREHOUSE_SORTABLE,
			defaultSort: WAREHOUSE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One stock location of the caller's tenant.
	 *
	 * A location that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('warehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async warehouse(@Args('id', { type: () => ID }) id: Id): Promise<Warehouse | null> {
		try {
			// The delivered route passes the relations its query string named; this surface's read names
			// none, which is the same call the route makes for an unstated request.
			return (await this.warehouseService.findById(id, [])) as Warehouse;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many stock locations the caller's tenant holds.
	 */
	@Query('warehouseCount')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async warehouseCount(): Promise<number> {
		return await this.warehouseService.countBy();
	}

	/**
	 * The stock levels held at one location.
	 *
	 * The same service method the delivered inventory route calls, with the route's own single
	 * argument: the read loads each level with the product it counts and the variant levels under it,
	 * which is what makes this a read of its own rather than a narrowed list of locations.
	 */
	@Query('warehouseInventory')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async warehouseInventory(
		@Args('warehouseId', { type: () => ID }) warehouseId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<WarehouseProduct>> {
		const levels: IWarehouseProduct[] = await this.warehouseProductService.getAllWarehouseProducts(warehouseId);

		return buildConnection<WarehouseProduct>({
			rows: (levels ?? []) as unknown as WarehouseProduct[],
			filterable: WAREHOUSE_PRODUCT_FILTERABLE,
			sortable: WAREHOUSE_PRODUCT_SORTABLE,
			defaultSort: WAREHOUSE_PRODUCT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Files a stock location through the same service method the delivered create route calls.
	 */
	@Mutation('createWarehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async createWarehouse(@Args('input') input: ICreateWarehouseInput): Promise<Warehouse> {
		return (await this.warehouseService.create(input as unknown as Warehouse)) as Warehouse;
	}

	/**
	 * Changes a stock location through the delivered edit route's own call.
	 *
	 * The route does not reach the CRUD base's partial update: it persists the stated body beside the
	 * path identifier through `create`, which is an upsert. This field makes the same call with the
	 * same body, so the two surfaces write the same row the same way — including the ownership check
	 * the service performs before it writes.
	 */
	@Mutation('updateWarehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async updateWarehouse(@Args('input') input: IUpdateWarehouseInput): Promise<Warehouse> {
		const { id, ...values } = input;

		return (await this.warehouseService.create({ ...values, id } as unknown as Warehouse)) as Warehouse;
	}

	/**
	 * Removes a stock location outright, with the stock levels held there.
	 */
	@Mutation('deleteWarehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async deleteWarehouse(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.warehouseService.delete(id);

		return true;
	}

	/**
	 * Withdraws a stock location: the row is marked rather than removed, and the recovery below reads
	 * it back.
	 */
	@Mutation('softDeleteWarehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async softDeleteWarehouse(@Args('id', { type: () => ID }) id: Id): Promise<Warehouse> {
		return await this.warehouseService.softRemove(id);
	}

	/**
	 * Puts a withdrawn stock location back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverWarehouse')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async recoverWarehouse(@Args('id', { type: () => ID }) id: Id): Promise<Warehouse> {
		return await this.warehouseService.softRecover(id);
	}

	/**
	 * Opens a stock level for each product named, at one location.
	 *
	 * The same service method the delivered bulk route calls, with the route's own two arguments: the
	 * list the input carries is handed on in the row shape the delivered body uses, because the service
	 * reads nothing from each row but the product identifier. The answer is the rows the write created —
	 * the delivered route answers the page envelope the bulk write produces, and the list's own length
	 * is the count that envelope carries.
	 *
	 * A location that is not there, or a set of products none of which is, is refused by the delivered
	 * method with a miss — so the field lets that refusal through rather than answering an empty list,
	 * which is what the route does.
	 */
	@Mutation('addWarehouseProducts')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async addWarehouseProducts(
		@Args('warehouseId', { type: () => ID }) warehouseId: Id,
		@Args('input') input: IAddWarehouseProductsInput
	): Promise<WarehouseProduct[]> {
		const rows: IWarehouseProductCreateInput[] = input.productIds.map(
			(productId) => ({ productId }) as unknown as IWarehouseProductCreateInput
		);
		const { items }: IPagination<IWarehouseProduct> =
			await this.warehouseProductService.createWarehouseProductBulk(rows, warehouseId);

		return (items ?? []) as unknown as WarehouseProduct[];
	}

	/**
	 * Sets the quantity held at one product level of a location.
	 *
	 * The delivered argument is named `count` on the route and `quantity` in the service; the field
	 * states the name the caller of the delivered API sees.
	 */
	@Mutation('updateWarehouseProductQuantity')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async updateWarehouseProductQuantity(
		@Args('warehouseProductId', { type: () => ID }) warehouseProductId: Id,
		@Args('count', { type: () => Number }) count: number
	): Promise<WarehouseProduct> {
		const level: IWarehouseProduct = await this.warehouseProductService.updateWarehouseProductQuantity(
			warehouseProductId,
			count
		);

		return level as unknown as WarehouseProduct;
	}

	/**
	 * Sets the quantity held at one variant level, and rolls the sum back up into the product level.
	 */
	@Mutation('updateWarehouseProductVariantQuantity')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async updateWarehouseProductVariantQuantity(
		@Args('warehouseProductVariantId', { type: () => ID }) warehouseProductVariantId: Id,
		@Args('count', { type: () => Number }) count: number
	): Promise<WarehouseProductVariant> {
		const level: IWarehouseProductVariant =
			await this.warehouseProductService.updateWarehouseProductVariantQuantity(warehouseProductVariantId, count);

		return level as unknown as WarehouseProductVariant;
	}
}
