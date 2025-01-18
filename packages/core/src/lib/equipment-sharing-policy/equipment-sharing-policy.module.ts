import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEquipmentSharingPolicyRepository } from './repository';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([EquipmentSharingPolicy]),
		MikroOrmModule.forFeature([EquipmentSharingPolicy]),
		RolePermissionModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [EquipmentSharingPolicyService, TypeOrmEquipmentSharingPolicyRepository],
	exports: []
})
export class EquipmentSharingPolicyModule {}
