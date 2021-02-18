import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';
import { PermissionGuard } from 'shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionsEnum } from '@gauzy/contracts';

@ApiTags('Warehouses')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class WarehouseController extends CrudController<Warehouse> {
	constructor(private readonly warehouseService: WarehouseService) {
		super(warehouseService);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	async createRecord(@Body() entity: Warehouse): Promise<any> {
		return this.warehouseService.create(entity);
	}
}
