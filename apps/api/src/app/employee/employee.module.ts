import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, UserService } from '../user';
import { CommandHandlers } from './commands/handlers';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { AuthService } from '../auth';
import { EmailService, EmailModule } from '../email';
import { UserOrganizationModule } from '../user-organization';

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
		UserService,
		AuthService,
		EmailService,
		...CommandHandlers
	],
	exports: [EmployeeService]
})
export class EmployeeModule {}
