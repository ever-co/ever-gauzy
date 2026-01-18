import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { EmployeeNotificationModule } from '../employee-notification/employee-notification.module';
import { Broadcast } from './broadcast.entity';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { TypeOrmBroadcastRepository } from './repository/type-orm-broadcast.repository';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([Broadcast]),
		MikroOrmModule.forFeature([Broadcast]),
		CqrsModule,
		RolePermissionModule,
		EmployeeModule,
		RoleModule,
		OrganizationTeamEmployeeModule,
		EmployeeNotificationModule,
	],
	controllers: [BroadcastController],
	providers: [BroadcastService, TypeOrmBroadcastRepository, ...CommandHandlers],
	exports: [BroadcastService, TypeOrmBroadcastRepository]
})
export class BroadcastModule {}
