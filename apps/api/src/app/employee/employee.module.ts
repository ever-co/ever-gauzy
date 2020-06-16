import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { AuthService } from '../auth/auth.service';
import { EmailService, EmailModule } from '../email';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { EmployeeNonTenantAwareService } from './employee-non-tenant-aware.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee, User]),
		EmailModule,
		UserOrganizationModule,
		CqrsModule
	],
	controllers: [EmployeeController],
	providers: [
		EmployeeService,
		EmployeeNonTenantAwareService,
		UserService,
		AuthService,
		EmailService,
		...CommandHandlers
	],
	exports: [TypeOrmModule, EmployeeService]
})
export class EmployeeModule {}
