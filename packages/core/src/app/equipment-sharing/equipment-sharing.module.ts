import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([RequestApproval, EquipmentSharing]),
		CqrsModule,
		TenantModule
	],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService, ...CommandHandlers],
	exports: [EquipmentSharingService]
})
export class EquipmentSharingModule {}
