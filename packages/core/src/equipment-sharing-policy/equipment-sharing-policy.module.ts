import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { TenantModule } from '../tenant/tenant.module';
import { TaskModule } from '../tasks/task.module';
import { UserModule } from '../user/user.module';

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
		TenantModule,
		TaskModule,
		UserModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [EquipmentSharingPolicyService],
	exports: [TypeOrmModule, MikroOrmModule, EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyModule { }
