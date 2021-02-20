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
import { IPagination, IWarehouse, PermissionsEnum } from '@gauzy/contracts';
import { ParseJsonPipe } from 'index';

@ApiTags('Warehouses')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class WarehouseController extends CrudController<Warehouse> {
	constructor(private readonly warehouseService: WarehouseService) {
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
}
