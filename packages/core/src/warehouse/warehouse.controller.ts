import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
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
	UseGuards
} from '@nestjs/common';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';
import { Permissions } from './../shared/decorators';
import {
	IPagination,
	PermissionsEnum,
	IWarehouseProduct,
	IWarehouseProductCreateInput,
	IWarehouseProductVariant
} from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { WarehouseProductService } from './warehouse-product-service';

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

	@ApiOperation({ summary: 'Find Warehouses Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Warehouses',
		type: Number
	})
	@Get('count')
	async count(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Number> {
		const { findInput = null } = data;
		return this.warehouseService.count(findInput);
	}

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
	async findAllWarehouses(
		@Query('data', ParseJsonPipe) data: any,
		@Query('page') page: any,
		@Query('_limit') limit: any
	): Promise<IPagination<Warehouse>> {
		const { relations = [], findInput = null } = data;
		return this.warehouseService.findAllWarehouses(relations, findInput, {page, limit});
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	async createRecord(@Body() entity: Warehouse): Promise<any> {
		return this.warehouseService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
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
	): Promise<any> {
		return this.warehouseService.updateWarehouse(id, entity);
	}

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
	@Post('/inventory/:warehouseId')
	async addWarehouseProducts(
		@Body() entity: IWarehouseProductCreateInput[],
		@Param('warehouseId', UUIDValidationPipe) warehouseId: string
	): Promise<IPagination<IWarehouseProduct[]>> {
		return await this.warehouseProductsService.createWarehouseProductBulk(
			entity,
			warehouseId
		);
	}

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
	@Get('/inventory/:warehouseId')
	async findAllWarehouseProducts(
		@Param('warehouseId', UUIDValidationPipe) warehouseId: string
	): Promise<IWarehouseProduct[]> {
		return this.warehouseProductsService.getAllWarehouseProducts(
			warehouseId
		);
	}

	@ApiOperation({
		summary: 'Update warehouse product count.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Warehouse product count updated.',
		type: Warehouse
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('/inventory-quantity/:warehouseProductId')
	async updateWarehouseProductCount(
		@Param('warehouseProductId', UUIDValidationPipe) warehouseProductId: string,
		@Body() value: { count: number }
	): Promise<IWarehouseProduct> {
		return this.warehouseProductsService.updateWarehouseProductQuantity(
			warehouseProductId,
			value.count
		);
	}

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
	async updateWarehouseProductVariantCount(
		@Param('warehouseProductVariantId', UUIDValidationPipe) warehouseProductVariantId: string,
		@Body() value: { count: number }
	): Promise<IWarehouseProductVariant> {
		return this.warehouseProductsService.updateWarehouseProductVariantQuantity(
			warehouseProductVariantId,
			value.count
		);
	}
}
