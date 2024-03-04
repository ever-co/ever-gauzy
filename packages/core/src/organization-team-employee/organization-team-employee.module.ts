import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { TaskModule } from './../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-team-employee',
				module: OrganizationTeamEmployeeModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationTeamEmployee]),
		MikroOrmModule.forFeature([OrganizationTeamEmployee]),
		TenantModule,
		RolePermissionModule,
		UserModule,
		TaskModule
	],
	controllers: [OrganizationTeamEmployeeController],
	providers: [OrganizationTeamEmployeeService],
	exports: [TypeOrmModule, MikroOrmModule, OrganizationTeamEmployeeService]
})
export class OrganizationTeamEmployeeModule { }
