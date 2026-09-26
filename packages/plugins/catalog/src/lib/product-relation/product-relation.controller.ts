import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { ProductRelationType } from '../catalog.types';
import { CreateProductRelationDTO, UpdateProductRelationDTO } from './dto';
import { ProductRelation } from './product-relation.entity';
import { ProductRelationService } from './product-relation.service';

@ApiTags('ProductRelation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-relations')
export class ProductRelationController extends CrudController<ProductRelation> {
	constructor(private readonly productRelationService: ProductRelationService) {
		super(productRelationService);
	}

	/**
	 * Creates one relation a product declares to another.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a product relation' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The relation was created', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductRelationDTO): Promise<ProductRelation> {
		return this.productRelationService.create(entity as any);
	}

	/**
	 * Updates one relation, which is how its type, rank or window is corrected.
	 */
	@ApiOperation({ summary: 'Update a product relation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The relation was updated', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductRelationDTO
	): Promise<ProductRelation> {
		return this.productRelationService.update(id, entity as any);
	}

	/**
	 * Read the relations declared from one product, which is the direction a product page renders.
	 */
	@ApiOperation({ summary: 'List the relations declared from a product' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Relations found', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-product/:productId')
	async findFrom(
		@Param('productId', UUIDValidationPipe) productId: string,
		@Query('type') type?: ProductRelationType
	): Promise<ProductRelation[]> {
		return this.productRelationService.findFrom(productId, type);
	}

	/**
	 * Deletes one product relation by id.
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler demanded nothing
	 * beyond this controller's class-level view grant. This override exists only to state its permission:
	 * the path and the body are the base class's, and the grant is `PRODUCTS_EDIT`, which is what the
	 * `deleteProductRelation` mutation declares for the same operation
	 * (`graphql/resolvers/product-relation.resolver.ts`).
	 *
	 * @param id The product relation to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a product relation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The relation was deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes one product relation by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `PRODUCTS_EDIT`.
	 *
	 * @param id The product relation to soft delete.
	 * @returns The soft-deleted relation.
	 */
	@ApiOperation({ summary: 'Soft delete a product relation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The relation was soft deleted' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted product relation by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `PRODUCTS_EDIT`, on the same path and the same body.
	 *
	 * @param id The product relation to restore.
	 * @returns The restored relation.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted product relation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The relation was restored' })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
