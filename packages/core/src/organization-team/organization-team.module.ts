import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user/user.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { TimerModule } from './../time-tracking/timer/timer.module';
import { StatisticModule } from './../time-tracking/statistic/statistic.module';
import { TaskModule } from './../tasks/task.module';
import { TypeOrmOrganizationTeamRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/organization-team', module: OrganizationTeamModule }
		]),
		TypeOrmModule.forFeature([OrganizationTeam]),
		MikroOrmModule.forFeature([OrganizationTeam]),
		OrganizationTeamEmployeeModule,
		RolePermissionModule,
		RoleModule,
		UserModule,
		OrganizationModule,
		EmployeeModule,
		TimerModule,
		CqrsModule,
		forwardRef(() => StatisticModule),
		TaskModule
	],
	controllers: [OrganizationTeamController],
	providers: [...QueryHandlers, ...CommandHandlers, OrganizationTeamService, TypeOrmOrganizationTeamRepository],
	exports: [TypeOrmModule, MikroOrmModule, OrganizationTeamService, TypeOrmOrganizationTeamRepository]
})
export class OrganizationTeamModule { }
