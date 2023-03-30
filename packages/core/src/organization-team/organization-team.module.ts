import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
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

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-team', module: OrganizationTeamModule }
		]),
		TypeOrmModule.forFeature([
			OrganizationTeam
		]),
		OrganizationTeamEmployeeModule,
		TenantModule,
		RoleModule,
		UserModule,
		OrganizationModule,
		EmployeeModule,
		TimerModule,
		CqrsModule,
		StatisticModule
	],
	controllers: [
		OrganizationTeamController
	],
	providers: [
		...QueryHandlers,
		...CommandHandlers,
		OrganizationTeamService
	],
	exports: [
		TypeOrmModule,
		OrganizationTeamService
	]
})
export class OrganizationTeamModule { }
