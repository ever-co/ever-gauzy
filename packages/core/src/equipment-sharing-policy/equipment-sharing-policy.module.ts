import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/equipment-sharing-policy',
				module: EquipmentSharingPolicyModule
			}
		]),
		TypeOrmModule.forFeature([EquipmentSharingPolicy]),
		MikroOrmModule.forFeature([EquipmentSharingPolicy]),
		RolePermissionModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [EquipmentSharingPolicyService],
	exports: [TypeOrmModule, MikroOrmModule, EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyModule { }
