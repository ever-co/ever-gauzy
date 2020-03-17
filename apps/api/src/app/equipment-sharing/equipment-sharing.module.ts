import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';

@Module({
	imports: [TypeOrmModule.forFeature([EquipmentSharing])],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService]
})
export class EquipmentSharingModule {}
