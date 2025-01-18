import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEquipmentSharingRepository } from './repository/type-orm-equipment-sharing.repository';
import { RequestApprovalModule } from '../request-approval/request-approval.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([EquipmentSharing]),
		MikroOrmModule.forFeature([EquipmentSharing]),
		CqrsModule,
		forwardRef(() => RequestApprovalModule),
		RolePermissionModule
	],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService, TypeOrmEquipmentSharingRepository, ...CommandHandlers]
})
export class EquipmentSharingModule {}
