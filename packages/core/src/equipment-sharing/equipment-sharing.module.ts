import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/equipment-sharing', module: EquipmentSharingModule }
		]),
		TypeOrmModule.forFeature([RequestApproval, EquipmentSharing, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService, ...CommandHandlers, UserService],
	exports: [EquipmentSharingService]
})
export class EquipmentSharingModule {}
