import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { RequestApproval } from '../request-approval/request-approval.entity';

@Module({
	imports: [TypeOrmModule.forFeature([EquipmentSharing, RequestApproval])],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService]
})
export class EquipmentSharingModule {}
