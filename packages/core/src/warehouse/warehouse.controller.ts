import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
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

import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';
import { PermissionGuard } from 'shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import {
	IPagination,
	IWarehouse,
	PermissionsEnum,
	IWarehouseProduct,
	IWarehouseProductCreateInput
} from '@gauzy/contracts';
import { ParseJsonPipe } from 'index';
import { WarehouseProductService } from './warehouse-product-service';

@ApiTags('Warehouses')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class WarehouseController extends CrudController<Warehouse> {
	constructor(
		private readonly warehouseService: WarehouseService,
		private readonly warehouseProductsService: WarehouseProductService
	) {
		super(warehouseService);
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
	async findAllProductTypes(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IWarehouse>> {
		const { relations = [], findInput = null } = data;
		return this.warehouseService.findAllWarehouses(relations, findInput);
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
		@Param('id') id: string,
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
		@Param('warehouseId') warehouseId: string
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
		@Param('warehouseId') warehouseId: string
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
		@Param('warehouseProductId') warehouseProductId: string,
		@Body() value: { count: number }
	): Promise<IWarehouseProduct> {
		return this.warehouseProductsService.updateWarehouseProductQuantity(
			warehouseProductId,
			value.count
		);
	}
}
