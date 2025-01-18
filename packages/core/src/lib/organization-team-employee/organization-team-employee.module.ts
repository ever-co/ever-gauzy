import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { TaskModule } from './../tasks/task.module';
import { TypeOrmOrganizationTeamEmployeeRepository } from './repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTeamEmployee]),
		MikroOrmModule.forFeature([OrganizationTeamEmployee]),
		RolePermissionModule,
		CqrsModule,
		TaskModule
	],
	controllers: [OrganizationTeamEmployeeController],
	providers: [
		OrganizationTeamEmployeeService,
		TypeOrmOrganizationTeamEmployeeRepository,
		MikroOrmOrganizationTeamEmployeeRepository
	],
	exports: [
		OrganizationTeamEmployeeService,
		TypeOrmOrganizationTeamEmployeeRepository,
		MikroOrmOrganizationTeamEmployeeRepository
	]
})
export class OrganizationTeamEmployeeModule {}
