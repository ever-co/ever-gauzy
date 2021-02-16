import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Controller, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { WarehouseService } from './warehouse.service';
import { Warehouse } from './warehouse.entity';

@ApiTags('Warehouses')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class WarehouseController extends CrudController<Warehouse> {
	constructor(private readonly warehouseService: WarehouseService) {
		super(warehouseService);
	}
}
