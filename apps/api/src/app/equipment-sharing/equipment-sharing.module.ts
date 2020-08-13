import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { TimeOffRequest } from '../time-off-request/time-off-request.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([RequestApproval, EquipmentSharing]),
		CqrsModule
	],
	controllers: [EquipmentSharingController],
	providers: [EquipmentSharingService, ...CommandHandlers],
	exports: [EquipmentSharingService]
})
export class EquipmentSharingModule {}
