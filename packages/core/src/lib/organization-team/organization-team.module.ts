import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
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
import { TypeOrmOrganizationTeamRepository } from './repository/type-orm-organization-team.repository';
import { MikroOrmOrganizationTeamRepository } from './repository/mikro-orm-organization-team.repository';

@Module({
	imports: [
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
	providers: [
		OrganizationTeamService,
		TypeOrmOrganizationTeamRepository,
		MikroOrmOrganizationTeamRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [OrganizationTeamService, TypeOrmOrganizationTeamRepository, MikroOrmOrganizationTeamRepository]
})
export class OrganizationTeamModule {}
