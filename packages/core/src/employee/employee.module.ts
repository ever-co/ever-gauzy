import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimeLog, TimeSlot } from './../core/entities/internal';
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
import { TypeOrmEmployeeRepository } from './repository/type-orm-employee.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee, TimeLog, TimeSlot]),
		MikroOrmModule.forFeature([Employee, TimeLog, TimeSlot]),
		forwardRef(() => EmailSendModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		forwardRef(() => AuthModule),
		RoleModule,
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [EmployeeService, TypeOrmEmployeeRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, EmployeeService, TypeOrmEmployeeRepository]
})
export class EmployeeModule {}
