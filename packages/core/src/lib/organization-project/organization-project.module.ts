import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectEmployee } from './organization-project-employee.entity';
import { OrganizationProjectController } from './organization-project.controller';
import { OrganizationProjectService } from './organization-project.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { TypeOrmOrganizationProjectRepository } from './repository/type-orm-organization-project.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from './repository/type-orm-organization-project-employee.repository';
import { PermissionGuard } from '../shared';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProject, OrganizationProjectEmployee]),
		MikroOrmModule.forFeature([OrganizationProject, OrganizationProjectEmployee]),
		RoleModule,
		EmployeeModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationProjectController],
	providers: [
		OrganizationProjectService,
		TypeOrmOrganizationProjectRepository,
		TypeOrmOrganizationProjectEmployeeRepository,
		PermissionGuard,
		...CommandHandlers
	],
	exports: [
		OrganizationProjectService,
		TypeOrmOrganizationProjectRepository,
		TypeOrmOrganizationProjectEmployeeRepository
	]
})
export class OrganizationProjectModule {}
