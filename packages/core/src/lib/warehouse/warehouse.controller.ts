import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import {
	IPagination,
	PermissionsEnum,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant,
	IWarehouse,
	ID
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { RelationsQueryDTO } from './../shared/dto';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { CreateWarehouseDTO, UpdateWarehouseDTO } from './dto';

@ApiTags('Warehouses')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
@Controller('/warehouses')
export class WarehouseController extends CrudController<Warehouse> {
	constructor(
		private readonly warehouseService: WarehouseService,
		private readonly warehouseProductsService: WarehouseProductService
	) {
		super(warehouseService);
	}

	/**
	 * GET all warehouse products
	 *
	 * @param warehouseId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all warehouse products.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found warehouse products.',
		type: Warehouse
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/inventory/:warehouseId')
	async findAllWarehouseProducts(
		@Param('warehouseId', UUIDValidationPipe) warehouseId: ID
	): Promise<IWarehouseProduct[]> {
		return await this.warehouseProductsService.getAllWarehouseProducts(warehouseId);
	}

	/**
	 * CREATE warehouse products
	 *
	 * @param entity
	 * @param warehouseId
	 * @returns
	 */

	@ApiOperation({ summary: 'Create warehouse products' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/inventory/:warehouseId')
	async addWarehouseProducts(
		@Param('warehouseId', UUIDValidationPipe) warehouseId: ID,
		@Body() entity: IWarehouseProductCreateInput[]
	): Promise<IPagination<IWarehouseProduct>> {
		return await this.warehouseProductsService.createWarehouseProductBulk(entity, warehouseId);
	}

	/**
	 * UPDATE warehouse product quantity
	 *
	 * @param warehouseProductId
	 * @param value
	 * @returns
	 */
	@ApiOperation({
		summary: 'Update warehouse product quantity.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Warehouse product quantity updated.',
		type: Warehouse
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('/inventory-quantity/:warehouseProductId')
	async updateWarehouseProductQuantity(
		@Param('warehouseProductId', UUIDValidationPipe) warehouseProductId: ID,
		@Body() value: { count: number }
	): Promise<IWarehouseProduct> {
		return await this.warehouseProductsService.updateWarehouseProductQuantity(warehouseProductId, value.count);
	}

	/**
	 * UPDATE warehouse product variant quantity
	 *
	 * @param warehouseProductVariantId
	 * @param value
	 * @returns
	 */
	@ApiOperation({
		summary: 'Update warehouse product variant count.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Warehouse product variant count updated.',
		type: Warehouse
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('/inventory-quantity/variants/:warehouseProductVariantId')
	async updateWarehouseProductVariantQuantity(
		@Param('warehouseProductVariantId', UUIDValidationPipe) warehouseProductVariantId: ID,
		@Body() value: { count: number }
	): Promise<IWarehouseProductVariant> {
		return await this.warehouseProductsService.updateWarehouseProductVariantQuantity(
			warehouseProductVariantId,
			value.count
		);
	}

	/**
	 * GET warehouse count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all warehouse count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found warehouse count'
	})
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/count')
	async getCount(@Query() options: FindOptionsWhere<Warehouse>): Promise<number> {
		return await this.warehouseService.countBy(options);
	}

	/**
	 * GET warehouses by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Warehouse>): Promise<IPagination<IWarehouse>> {
		return await this.warehouseService.paginate(params);
	}

	/**
	 * GET warehouses
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all warehouses.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found warehouses.',
		type: Warehouse
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Warehouse>): Promise<IPagination<IWarehouse>> {
		return await this.warehouseService.findAll(params);
	}

	/**
	 * GET warehouse with relations by id
	 *
	 * @param id
	 * @returns
	 */
	@Get('/:id')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() query: RelationsQueryDTO): Promise<IWarehouse> {
		return await this.warehouseService.findById(id, query.relations);
	}

	/**
	 * CREATE new warehouse store
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateWarehouseDTO): Promise<IWarehouse> {
		return await this.warehouseService.create(entity);
	}

	/**
	 * UPDATE warehouse by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing warehouse' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The warehouse record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateWarehouseDTO
	): Promise<IWarehouse | UpdateResult> {
		return await this.warehouseService.create({
			...entity,
			id
		});
	}
}
