import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { User } from '../user/user.entity';
import { AuthService } from '../auth';
import { UserService } from '../user';
import { EmailModule } from '../email-templates/email.module';
import { EmailService } from '../email-templates/email.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Employee]),
		TypeOrmModule.forFeature([User]),
		CqrsModule,
		EmailModule
	],
	controllers: [EmployeeController],
	providers: [
		EmployeeService,
		...CommandHandlers,
		AuthService,
		UserService,
		EmailService
	],
	exports: [EmployeeService]
})
export class EmployeeModule {}
