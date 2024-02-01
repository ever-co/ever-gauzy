import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { Equipment } from './equipment.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/equipment', module: EquipmentModule }]),
		TypeOrmModule.forFeature([Equipment]),
		MikroOrmModule.forFeature([Equipment]),
		TenantModule
	],
	controllers: [EquipmentController],
	providers: [EquipmentService],
	exports: [EquipmentService]
})
export class EquipmentModule { }
