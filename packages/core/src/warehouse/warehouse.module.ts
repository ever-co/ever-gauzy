import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { WarehouseService } from './warehouse.service';
import { TenantModule } from '../tenant/tenant.module';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './warehouse.entity';
import { UserService } from 'user/user.service';
import { User } from 'core';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/warehouses', module: WarehouseModule }
		]),
		TypeOrmModule.forFeature([Warehouse, User]),
		TenantModule
	],
	controllers: [WarehouseController],
	providers: [WarehouseService, UserService]
})
export class WarehouseModule {}
