import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/equipment-sharing-policy',
				module: EquipmentSharingPolicyModule
			}
		]),
		TypeOrmModule.forFeature([User, EquipmentSharingPolicy]),
		MikroOrmModule.forFeature([User, EquipmentSharingPolicy]),
		TenantModule,
		RolePermissionModule,
		TaskModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [EquipmentSharingPolicyService, UserService],
	exports: [TypeOrmModule, MikroOrmModule, EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyModule { }
