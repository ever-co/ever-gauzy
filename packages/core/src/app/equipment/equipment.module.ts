import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from './equipment.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([Equipment]), TenantModule],
	controllers: [EquipmentController],
	providers: [EquipmentService],
	exports: [EquipmentService]
})
export class EquipmentModule {}
