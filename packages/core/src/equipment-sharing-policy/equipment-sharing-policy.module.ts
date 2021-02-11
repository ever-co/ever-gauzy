import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/equipment-sharing-policy',
				module: EquipmentSharingPolicyModule
			}
		]),
		TypeOrmModule.forFeature([User, EquipmentSharingPolicy]),
		TenantModule
	],
	controllers: [EquipmentSharingPolicyController],
	providers: [EquipmentSharingPolicyService, UserService],
	exports: [TypeOrmModule, EquipmentSharingPolicyService]
})
export class EquipmentSharingPolicyModule {}
