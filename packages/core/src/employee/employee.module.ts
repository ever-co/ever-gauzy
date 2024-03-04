import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GauzyAIModule } from '@gauzy/integration-ai';
import { TimeLog } from './../core/entities/internal';
import { Employee } from './employee.entity';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { AuthModule } from './../auth/auth.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/employee', module: EmployeeModule }
		]),
		TypeOrmModule.forFeature([Employee, TimeLog]),
		MikroOrmModule.forFeature([Employee, TimeLog]),
		forwardRef(() => EmailSendModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		forwardRef(() => AuthModule),
		RoleModule,
		GauzyAIModule.forRoot(),
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [EmployeeService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, EmployeeService]
})
export class EmployeeModule { }
