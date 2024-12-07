import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/equipment-sharing', module: EquipmentSharingModule }]),
		TypeOrmModule.forFeature([RequestApproval, EquipmentSharing]),
		MikroOrmModule.forFeature([RequestApproval, EquipmentSharing]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService, ...CommandHandlers],
	exports: [EquipmentSharingService]
})
export class EquipmentSharingModule { }
