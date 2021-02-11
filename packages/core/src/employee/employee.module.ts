import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { GauzyAIService } from '@gauzy/integration-ai';
import { Employee, TimeLog, User } from './../core/entities/internal';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { AuthService } from '../auth/auth.service';
import { EmailService, EmailModule } from '../email';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/employee', module: EmployeeModule }]),
		TypeOrmModule.forFeature([Employee, User, TimeLog]),
		EmailModule,
		UserOrganizationModule,
		CqrsModule,
		TenantModule
	],
	controllers: [EmployeeController],
	providers: [
		EmployeeService,
		UserService,
		AuthService,
		EmailService,
		GauzyAIService,
		...CommandHandlers
	],
	exports: [TypeOrmModule, EmployeeService]
})
export class EmployeeModule {}
