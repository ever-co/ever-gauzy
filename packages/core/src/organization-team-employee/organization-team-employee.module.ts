import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { TaskModule } from './../tasks/task.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
		UserModule,
		TaskModule
	],
	controllers: [OrganizationTeamEmployeeController],
	providers: [OrganizationTeamEmployeeService],
	exports: [TypeOrmModule, OrganizationTeamEmployeeService]
})
export class OrganizationTeamEmployeeModule { }
