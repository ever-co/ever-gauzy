import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { OrganizationProjectModuleService } from './organization-project-module.service';
import { OrganizationProjectModuleController } from './organization-project-module.controller';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
import { EmployeeModule } from '../employee/employee.module';
import { TaskModule } from '../tasks/task.module';
import { OrganizationProjectModuleEmployee } from './organization-project-module-employee.entity';
import { TypeOrmOrganizationProjectModuleRepository } from './repository/type-orm-organization-project-module.repository';
import { TypeOrmOrganizationProjectModuleEmployeeRepository } from './repository/type-orm-organization-project-module-employee.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationProjectModule, OrganizationProjectModuleEmployee]),
		MikroOrmModule.forFeature([OrganizationProjectModule, OrganizationProjectModuleEmployee]),
		MikroOrmModule,
		RolePermissionModule,
		RoleModule,
		EmployeeModule,
		TaskModule,
		CqrsModule
	],
	controllers: [OrganizationProjectModuleController],
	providers: [
		OrganizationProjectModuleService,
		TypeOrmOrganizationProjectModuleRepository,
		TypeOrmOrganizationProjectModuleEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationProjectModuleService,
		TypeOrmOrganizationProjectModuleRepository,
		TypeOrmOrganizationProjectModuleEmployeeRepository
	]
})
export class OrganizationProjectModuleModule {}
