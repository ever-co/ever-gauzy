import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PaginationParams } from './../core/crud';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import {
	IPagination,
	PermissionsEnum,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant,
	IWarehouse
} from '@gauzy/contracts';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';
import { WarehouseProductService } from './warehouse-product-service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { RequestContext } from './../core/context';

@ApiTags('Warehouses')
@UseGuards(TenantPermissionGuard)
@Controller()
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
	@Get('inventory/:warehouseId')
	async findAllWarehouseProducts(
		@Param('warehouseId', UUIDValidationPipe) warehouseId: string
	): Promise<IWarehouseProduct[]> {
		return this.warehouseProductsService.getAllWarehouseProducts(
			warehouseId
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('inventory/:warehouseId')
	async addWarehouseProducts(
		@Body() entity: IWarehouseProductCreateInput[],
		@Param('warehouseId', UUIDValidationPipe) warehouseId: string
	): Promise<IPagination<IWarehouseProduct[]>> {
		return await this.warehouseProductsService.createWarehouseProductBulk(
			entity,
			warehouseId
		);
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
	@Post('inventory-quantity/:warehouseProductId')
	async updateWarehouseProductQuantity(
		@Param('warehouseProductId', UUIDValidationPipe) warehouseProductId: string,
		@Body() value: { count: number }
	): Promise<IWarehouseProduct> {
		return this.warehouseProductsService.updateWarehouseProductQuantity(
			warehouseProductId,
			value.count
		);
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
	@Post('inventory-quantity/variants/:warehouseProductVariantId')
	async updateWarehouseProductVariantQuantity(
		@Param('warehouseProductVariantId', UUIDValidationPipe) warehouseProductVariantId: string,
		@Body() value: { count: number }
	): Promise<IWarehouseProductVariant> {
		return this.warehouseProductsService.updateWarehouseProductVariantQuantity(
			warehouseProductVariantId,
			value.count
		);
	}

	/**
	 * GET warehouse count
	 * 
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all warehouse count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found warehouse count'
	})
	@Get('count')
	async getCount(
		@Query() filter: PaginationParams<Warehouse>
	): Promise<number> {
		return await this.warehouseService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
	}

	/**
	 * GET warehouses by pagination
	 * 
	 * @param filter 
	 * @returns 
	 */
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<Warehouse>
	): Promise<IPagination<IWarehouse>> {
		return this.warehouseService.paginate(filter);
	}

	/**
	 * GET all warehouses
	 * 
	 * @param data 
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IWarehouse>> {
		const { relations = [], findInput = null } = data;
		return this.warehouseService.findAllWarehouses(relations, findInput);
	}

	/**
	 * GET warehouse with relations by id
	 * 
	 * @param id 
	 * @param data 
	 * @returns 
	 */
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IWarehouse> {
		const { relations = [], findInput = null } = data;
		return await this.warehouseService.findOne(id, {
			where: {
				...findInput
			},
			relations
		});
	}

	/**
	 * CREATE new warehouse record
	 * 
	 * @param entity 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() entity: Warehouse
	): Promise<IWarehouse> {
		return this.warehouseService.create(entity);
	}

	/**
	 * UPDATE an existing warehouse
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: Warehouse
	): Promise<IWarehouse> {
		return await this.warehouseService.update(id, entity);
	}
}
