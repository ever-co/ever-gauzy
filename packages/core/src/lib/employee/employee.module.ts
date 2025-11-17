import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserModule } from './../user/user.module';
import { AuthModule } from './../auth/auth.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { ManagedEmployeeService } from './managed-employee.service';
import { Employee } from './employee.entity';
import { TypeOrmEmployeeRepository } from './repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from './repository/mikro-orm-employee.repository';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { OrganizationProjectEmployee } from '../organization-project/organization-project-employee.entity';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from '../organization-project/repository/type-orm-organization-project-employee.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee, OrganizationTeamEmployee, OrganizationProjectEmployee]),
		MikroOrmModule.forFeature([Employee, OrganizationTeamEmployee, OrganizationProjectEmployee]),
		forwardRef(() => EmailSendModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		forwardRef(() => AuthModule),
		RoleModule,
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [
		EmployeeService,
		ManagedEmployeeService,
		TypeOrmEmployeeRepository,
		MikroOrmEmployeeRepository,
		TypeOrmOrganizationTeamEmployeeRepository,
		TypeOrmOrganizationProjectEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		EmployeeService,
		ManagedEmployeeService,
		TypeOrmEmployeeRepository,
		MikroOrmEmployeeRepository,
		TypeOrmOrganizationTeamEmployeeRepository,
		TypeOrmOrganizationProjectEmployeeRepository
	]
})
export class EmployeeModule {}
