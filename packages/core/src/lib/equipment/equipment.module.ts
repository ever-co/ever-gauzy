import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Equipment } from './equipment.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEquipmentRepository } from './repository/type-orm-equipment.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Equipment]), MikroOrmModule.forFeature([Equipment]), RolePermissionModule],
	controllers: [EquipmentController],
	providers: [EquipmentService, TypeOrmEquipmentRepository]
})
export class EquipmentModule {}
