import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-team-employee', module: OrganizationTeamEmployeeModule }
		]),
		TypeOrmModule.forFeature([
			OrganizationTeamEmployee
		]),
		TenantModule,
		UserModule
	],
	controllers: [
		OrganizationTeamEmployeeController
	],
	providers: [
		OrganizationTeamEmployeeService
	],
	exports: [
		TypeOrmModule,
		OrganizationTeamEmployeeService
	]
})
export class OrganizationTeamEmployeeModule {}
